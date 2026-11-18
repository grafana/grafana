{
  description = ''
    The open and composable observability and data visualization platform.
    Visualize metrics, logs, and traces from multiple sources like Prometheus, Loki, Elasticsearch, InfluxDB, Postgres and many more.
  '';

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";

  outputs =
    { self, nixpkgs }:
    let
      inherit (nixpkgs) lib;
      systems = {
        aarch64-darwin = "darwin-arm64";
        aarch64-linux = "linux-arm64";
        x86_64-darwin = "darwin-amd64";
        x86_64-linux = "linux-amd64";
      };
      manifest = builtins.fromJSON (builtins.readFile ./package.json);
      version = lib.replaceStrings [ "-pre" ] [ "-local" ] manifest.version;
      src = lib.fileset.toSource {
        root = ./.;
        fileset = lib.fileset.difference ./. (
          lib.fileset.unions [
            ./flake.nix
            ./flake.lock
            ./nix
          ]
        );
      };
      tarballSrc = lib.fileset.toSource {
        root = ./.;
        fileset = lib.fileset.unions [
          ./conf
          ./Dockerfile
          ./docs/sources
          ./LICENSE
          ./NOTICE.md
          ./packaging
          ./README.md
          ./scripts/build-targz.sh
        ];
      };
      catalogPlugins = builtins.fromJSON (builtins.readFile ./nix/catalog-plugins.json);
      sourceDateEpoch = toString (self.lastModified or 1);

      targets = [
        {
          goos = "linux";
          goarch = "amd64";
        }
        {
          goos = "linux";
          goarch = "arm64";
        }
        {
          goos = "linux";
          goarch = "arm";
          goarm = "6";
        }
        {
          goos = "linux";
          goarch = "arm";
          goarm = "7";
        }
        {
          goos = "linux";
          goarch = "s390x";
        }
        {
          goos = "linux";
          goarch = "riscv64";
        }
        {
          goos = "windows";
          goarch = "amd64";
        }
        {
          goos = "windows";
          goarch = "arm64";
        }
        {
          goos = "darwin";
          goarch = "amd64";
        }
        {
          goos = "darwin";
          goarch = "arm64";
        }
      ];
    in
    {
      packages = lib.mapAttrs (
        system: nativeTarget:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          pnpm = pkgs.pnpm_12;

          frontend = pkgs.stdenvNoCC.mkDerivation (finalAttrs: {
            pname = "grafana-frontend";
            inherit src version;
            strictDeps = true;
            nativeBuildInputs = [
              pkgs.nodejs_26
              pnpm
              pkgs.pnpmConfigHook
            ];
            pnpmDeps = pkgs.fetchPnpmDeps {
              inherit (finalAttrs) pname;
              inherit pnpm;
              src = lib.fileset.toSource {
                root = ./.;
                fileset = lib.fileset.unions (
                  [
                    ./package.json
                    ./pnpm-lock.yaml
                    ./pnpm-workspace.yaml
                    ./patches
                  ]
                  ++ map (lib.fileset.fileFilter (file: file.name == "package.json")) [
                    ./packages
                    ./public/app/plugins
                    ./e2e-playwright/test-plugins
                  ]
                );
              };
              fetcherVersion = 5;
              hash = "sha256-LpVbSMHU4XI7WANB7MRAsoxPMHKDGKxm+JMEtjINTwc=";
            };
            env = {
              CI = "true";
              # Nx's native runner tries to configure a terminal in the headless builder.
              NX_NATIVE_COMMAND_RUNNER = "false";
            };
            buildPhase = ''
              runHook preBuild
              bash scripts/build-frontend.sh
              runHook postBuild
            '';
            installPhase = ''
              runHook preInstall
              cp -R dist/frontend "$out"
              runHook postInstall
            '';
          });

          mkTargetPackages =
            {
              goos,
              goarch,
              goarm ? "",
            }:
            let
              platform = "${goos}-${goarch}";
              target = "${platform}${lib.optionalString (goarm != "") "v${goarm}"}";
              executable = "grafana${lib.optionalString (goos == "windows") ".exe"}";
              backend = pkgs.buildGo127Module {
                pname = "grafana-backend-${target}";
                inherit src version;
                # Keep the workspace and download cache shared across all CGO-free targets.
                proxyVendor = true;
                vendorHash = "sha256-AL2FPYnTrtAgAsbSzdD7rZ3MreU+/LM2cJWsCpV4O/U=";
                overrideModAttrs = _: _: { name = "grafana-${version}-go-modules"; };
                env.CGO_ENABLED = "0";
                doCheck = false;
                dontStrip = true;
                meta.mainProgram = executable;
                buildPhase = ''
                  runHook preBuild
                  GOMAXPROCS="$NIX_BUILD_CORES" make build-go OS=${goos} ARCH=${goarch} ARM=${goarm} \
                    BUILD_VERSION=${lib.escapeShellArg version} \
                    COMMIT_SHA=${self.rev or self.dirtyRev or "unknown"} \
                    SOURCE_DATE_EPOCH=${sourceDateEpoch}
                  runHook postBuild
                '';
                installPhase = ''
                  runHook preInstall
                  install -Dm755 bin/${goos}/${goarch}/${executable} "$out/bin/${executable}"
                  runHook postInstall
                '';
                doInstallCheck = true;
                installCheckPhase = ''
                  runHook preInstallCheck
                  buildInfo=$(go version -m "$out/bin/${executable}")
                  grep -Fx $'\tbuild\tGOOS=${goos}' <<< "$buildInfo"
                  grep -Fx $'\tbuild\tGOARCH=${goarch}' <<< "$buildInfo"
                  grep -Fx $'\tbuild\tCGO_ENABLED=0' <<< "$buildInfo"
                  ${lib.optionalString (goarm != "") ''
                    grep -E $'^\tbuild\tGOARM=${goarm}(,|$)' <<< "$buildInfo"
                  ''}
                  runHook postInstallCheck
                '';
              };
              pluginArchives = lib.mapAttrs (
                id:
                { version, hashes }:
                let
                  # Match the catalog's OS/arch lookup. ARM variants share linux-arm,
                  # and generic "any" archives can cover a subset of backend targets.
                  variant = if builtins.hasAttr platform hashes then platform else "any";
                  query = lib.optionalString (variant != "any") "?os=${goos}&arch=${goarch}";
                in
                pkgs.fetchurl {
                  name = "${id}-${version}-${variant}.zip";
                  url = "https://grafana.com/api/plugins/${id}/versions/${version}/download${query}";
                  hash = hashes.${variant};
                }
              ) catalogPlugins;
              tarball = pkgs.stdenvNoCC.mkDerivation {
                pname = "grafana-tarball-${target}";
                inherit version;
                src = tarballSrc;
                strictDeps = true;
                nativeBuildInputs = [
                  pkgs.gnutar
                  pkgs.go_1_27
                  pkgs.jq
                  pkgs.libarchive
                ];
                env = {
                  OS = goos;
                  ARCH = goarch;
                  GOARM = goarm;
                  BUILD_VERSION = version;
                  TAR_OPTIONS = "--sort=name --mtime=@${sourceDateEpoch} --owner=0 --group=0 --numeric-owner";
                };
                dontConfigure = true;
                # The fixup audit probes compressed archives for executable files.
                dontFixup = true;
                buildPhase = ''
                  runHook preBuild
                  mkdir -p dist data/plugins-bundled
                  install -Dm755 ${backend}/bin/${executable} "bin/${goos}/${goarch}/${executable}"
                  cp -RL ${frontend} dist/frontend

                  ${lib.concatStringsSep "\n" (
                    lib.mapAttrsToList (id: archive: ''
                      bash ${./nix/extract-plugin.sh} ${lib.escapeShellArg id} "${archive}" data/plugins-bundled
                    '') pluginArchives
                  )}
                  chmod -R u+w dist/frontend data/plugins-bundled
                  bash scripts/build-targz.sh
                  runHook postBuild
                '';
                installPhase = ''
                  runHook preInstall
                  mkdir -p "$out"
                  install -m644 dist/*.tar.gz "$out/"
                  runHook postInstall
                '';
              };
            in
            lib.nameValuePair target { inherit backend tarball; };
          targetPackages = builtins.listToAttrs (map mkTargetPackages targets);
          inherit (targetPackages.${nativeTarget}) backend tarball;
        in
        lib.concatMapAttrs (target: { backend, tarball }: {
          "backend-${target}" = backend;
          "tarball-${target}" = tarball;
        }) targetPackages
        // {
          inherit backend frontend tarball;
          default = tarball;
        }
      ) systems;
    };
}
