{
  description = "Grafana OSS backend and frontend";

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
      forAllSystems = lib.genAttrs (builtins.attrNames systems);
      manifest = builtins.fromJSON (builtins.readFile ./package.json);
      version = lib.replaceStrings [ "-pre" ] [ "-local" ] manifest.version;
      src = lib.fileset.toSource {
        root = ./.;
        fileset = lib.fileset.difference ./. (
          lib.fileset.unions [
            ./flake.nix
            ./flake.lock
          ]
        );
      };

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
      packages = forAllSystems (
        system:
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

          mkBackend =
            {
              goos,
              goarch,
              goarm ? "",
            }:
            let
              target = "${goos}-${goarch}${lib.optionalString (goarm != "") "v${goarm}"}";
              executable = "grafana${lib.optionalString (goos == "windows") ".exe"}";
            in
            lib.nameValuePair target (
              pkgs.buildGo127Module {
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
                    SOURCE_DATE_EPOCH=${toString (self.lastModified or 1)}
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
              }
            );
          backends = builtins.listToAttrs (map mkBackend targets);
          backend = backends.${systems.${system}};
          grafana = pkgs.runCommand "grafana-${version}" { meta.mainProgram = "grafana"; } ''
            mkdir -p "$out/bin" "$out/share/grafana"
            ln -s ${backend}/bin/grafana "$out/bin/grafana"
            ln -s ${frontend} "$out/share/grafana/public"
            ln -s ${./conf} "$out/share/grafana/conf"
          '';
        in
        lib.mapAttrs' (target: lib.nameValuePair "backend-${target}") backends
        // {
          inherit backend frontend grafana;
          default = grafana;
        }
      );
    };
}
