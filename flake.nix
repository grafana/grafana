{
  description = ''
    The open and composable observability and data visualization platform.
    Visualize metrics, logs, and traces from multiple sources like Prometheus, Loki, Elasticsearch, InfluxDB, Postgres and many more.
  '';

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    let
      # System-independent: version resolution and build target lists.
      packageJson = builtins.fromJSON (builtins.readFile ./package.json);
      buildId =
        if builtins.pathExists ./build-id then
          nixpkgs.lib.removeSuffix "\n" (builtins.readFile ./build-id)
        else
          null;
      grafanaVersion =
        if buildId != null then
          builtins.replaceStrings [ "pre" ] [ buildId ] packageJson.version
        else
          packageJson.version;
      buildNumber = if buildId != null then buildId else "local";

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

      debTargets = builtins.filter (t: t.goos == "linux") targets;
      rpmTargets = builtins.filter (t: t.goos == "linux" && t.goarch != "arm") targets;

      mkTargetName =
        prefix:
        {
          goos,
          goarch,
          goarm ? null,
          ...
        }:
        "${prefix}-${goos}-${goarch}${nixpkgs.lib.optionalString (goarm != null) "v${goarm}"}";

      # Artifact filename arch label: arm variants use "arm-6"/"arm-7"
      # (matches scripts/build-{deb,rpm}.sh ARCH_LABEL).
      mkArchLabel =
        {
          goarch,
          goarm ? null,
          ...
        }:
        "${goarch}${nixpkgs.lib.optionalString (goarm != null) "-${goarm}"}";

      backendTargetName = mkTargetName "backend";
      targzTargetName = mkTargetName "targz";
      debTargetName = mkTargetName "deb";
      rpmTargetName = mkTargetName "rpm";
    in
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = nixpkgs.legacyPackages.${system};

        # While nixpkgs does not yet have 1.26.4 on unstable.
        go_1_26_4 = pkgs.go_1_26.overrideAttrs (old: rec {
          version = "1.26.4";
          src = pkgs.fetchurl {
            url = "https://dl.google.com/go/go${version}.src.tar.gz";
            hash = "sha256-T2aKMvv8ETLmqIH7lowvHa2mMUkqM5IRc1+7JVpCYC0=";
          };
        });

        # Main function to build the backend.
        mkBackend =
          {
            goos,
            goarch,
            goarm ? null,
            ...
          }:
          pkgs.buildGo126Module.override
            {
              go =
                # Temporarily while nixpkgs does not have this version upstream.
                go_1_26_4

                # buildGoModule cross-compiles via `inherit (go) GOOS GOARCH`, so
                # we merge the target values onto the base go package to override
                # them. (GOARM is not inherited from `go`; it is set via env below.)
                // {
                  GOOS = goos;
                  GOARCH = goarch;
                };
            }
            {
              pname = "grafana";
              version = grafanaVersion;
              src = ./.;
              proxyVendor = true;
              vendorHash = "sha256-SQvx/Muu+SDOTeXoDwwRXa2LYY06uVIugF4yKdU1928=";
              subPackages = [ "./pkg/cmd/grafana" ];

              doCheck = false;

              env.CGO_ENABLED = "0";
              # buildGoModule inherits only GOOS/GOARCH from `go`, so GOARM must
              # be passed through the build env to take effect for arm targets.
              env.GOARM = if goarm != null then goarm else "";

              dontStrip = true;
              ldflags = [
                "-s"
                "-w"
                "-X main.version=${grafanaVersion}"
                "-X main.commit=${self.rev or "unknown"}"
                "-X main.buildBranch=main"
                "-X main.buildstamp=0"
              ];

              # Replicates how we've been organizing the output folder for the backend build.
              postInstall =
                let
                  ext = pkgs.lib.optionalString (goos == "windows") ".exe";
                in
                ''
                  mkdir -p $out/bin/${goos}/${goarch}
                  if [ -f $out/bin/${goos}_${goarch}/grafana${ext} ]; then
                    mv $out/bin/${goos}_${goarch}/grafana${ext} $out/bin/${goos}/${goarch}/grafana${ext}
                  else
                    mv $out/bin/grafana${ext} $out/bin/${goos}/${goarch}/grafana${ext}
                  fi
                '';
            };

        # Frontend assets.
        mkFrontend = pkgs.stdenv.mkDerivation (finalAttrs: {
          name = "grafana-frontend";
          # Scope the source to what the frontend build needs. Excluding the Go
          # backend and the flake files keeps this derivation (and the shared
          # offlineCache) stable when only backend/flake code changes, so editing
          # them no longer forces a full frontend rebuild.
          src = pkgs.lib.fileset.toSource {
            root = ./.;
            fileset = pkgs.lib.fileset.difference ./. (
              pkgs.lib.fileset.unions [
                ./.github
                ./apps
                ./pkg
                ./flake.nix
                ./flake.lock
                ./missing-hashes.json
              ]
            );
          };
          nativeBuildInputs = [
            pkgs.nodejs_24
            pkgs.faketty
            pkgs.yarn-berry_4
            pkgs.yarn-berry_4.yarnBerryConfigHook
          ];
          # nix run nixpkgs#yarn-berry_4.yarn-berry-fetcher -- missing-hashes yarn.lock > missing-hashes.json
          missingHashes = ./missing-hashes.json;
          offlineCache = pkgs.yarn-berry_4.fetchYarnBerryDeps {
            inherit (finalAttrs) src missingHashes;
            hash = "sha256-qhDG/lkP1uyxvcSucYbNPKG4gM4wxtjJbMUyWP30H2k=";
          };
          YARN_ENABLE_SCRIPTS = "0";

          # The Nix sandbox strips the environment, so nx never sees CI=true and starts its background daemon.
          # Disabling the daemon keeps the build self-contained.
          NX_DAEMON = "false";

          # Frontend output is static assets, skip the pointless strip pass.
          dontStrip = true;

          # Need "faketty" otherwise build panics: https://github.com/nrwl/nx/issues/22445
          buildPhase = ''
            faketty yarn build
          '';

          installPhase = ''
            cp -r public $out
          '';
        });

        # Builds the package tree used by tar, deb and rpm.
        mkPkgTree =
          {
            goos,
            goarch,
            goarm ? null,
            ...
          }:
          let
            backend = mkBackend { inherit goos goarch goarm; };
          in
          pkgs.stdenv.mkDerivation {
            name = "grafana-${grafanaVersion}-pkg-tree-${goos}-${mkArchLabel { inherit goarch goarm; }}";
            nativeBuildInputs = [ go_1_26_4 ];
            dontUnpack = true;
            buildPhase = ''
              mkdir -p $out/{bin,tools,docs,packaging,data/plugins-bundled,plugins-bundled}

              echo "${grafanaVersion}" > $out/VERSION

              cp ${./LICENSE}               $out/LICENSE
              cp ${./NOTICE.md}             $out/NOTICE.md
              cp ${./README.md}             $out/README.md
              cp ${./Dockerfile}            $out/Dockerfile
              cp -r ${./conf}               $out/conf
              cp -r ${./docs/sources}       $out/docs/sources
              cp -r ${./packaging/deb}      $out/packaging/deb
              cp -r ${./packaging/rpm}      $out/packaging/rpm
              cp -r ${./packaging/docker}   $out/packaging/docker
              cp -r ${./packaging/wrappers} $out/packaging/wrappers
              cp $(${go_1_26_4}/bin/go env GOROOT)/lib/time/zoneinfo.zip $out/tools/
              cp ${backend}/bin/${goos}/${goarch}/grafana* $out/bin/
              cp -r ${mkFrontend} $out/public
            '';
            installPhase = "true";
          };

        # Final tar artifact.
        mkTargz =
          {
            goos,
            goarch,
            goarm ? null,
            ...
          }:
          let
            tree = mkPkgTree { inherit goos goarch goarm; };
            archLabel = mkArchLabel { inherit goarch goarm; };
            filename = "grafana_${grafanaVersion}_${buildNumber}_${goos}_${archLabel}.tar.gz";
            root = "grafana-${grafanaVersion}";
          in
          pkgs.stdenv.mkDerivation {
            name = filename;
            nativeBuildInputs = [ pkgs.gnutar ];
            dontUnpack = true;
            buildPhase = ''
              cp -r ${tree} ${root}
              tar -czf ${filename} ${root}
            '';
            installPhase = ''
              mkdir -p $out
              cp ${filename} $out/${filename}
            '';
          };

        # .deb package assembly.
        mkDeb =
          {
            goos,
            goarch,
            goarm ? null,
            ...
          }:
          let
            tree = mkPkgTree { inherit goos goarch goarm; };
            archLabel = mkArchLabel { inherit goarch goarm; };
            debPkgName = if goarm == "6" then "grafana-rpi" else "grafana";
            # Strip v prefix, replace +security- with - (matches build-deb.sh debVersion logic).
            debVersion = builtins.replaceStrings [ "+security-" ] [ "-" ] (
              nixpkgs.lib.removePrefix "v" grafanaVersion
            );
            pkgArch = if goarch == "arm" then "armhf" else goarch;
            filename = "${debPkgName}_${grafanaVersion}_${buildNumber}_${goos}_${archLabel}.deb";
          in
          pkgs.stdenv.mkDerivation {
            name = filename;
            nativeBuildInputs = [ pkgs.fpm ];
            dontUnpack = true;
            buildPhase = ''
              mkdir -p pkg/usr/sbin
              mkdir -p pkg/usr/share/grafana
              mkdir -p pkg/etc/default pkg/etc/grafana pkg/etc/init.d
              mkdir -p pkg/usr/lib/systemd/system

              cp -r ${tree} pkg/usr/share/grafana
              chmod -R u+w pkg/usr/share/grafana

              cp ${tree}/packaging/wrappers/grafana        pkg/usr/sbin/grafana
              cp ${tree}/packaging/wrappers/grafana-server pkg/usr/sbin/grafana-server
              cp ${tree}/packaging/wrappers/grafana-cli    pkg/usr/sbin/grafana-cli
              chmod 0755 pkg/usr/sbin/grafana pkg/usr/sbin/grafana-server pkg/usr/sbin/grafana-cli

              cp ${tree}/packaging/deb/default/grafana-server         pkg/etc/default/grafana-server
              cp ${tree}/packaging/deb/init.d/grafana-server          pkg/etc/init.d/grafana-server
              cp ${tree}/packaging/deb/systemd/grafana-server.service pkg/usr/lib/systemd/system/grafana-server.service
              chmod 0755 pkg/etc/init.d/grafana-server
              chmod 0644 pkg/etc/default/grafana-server

              fpm \
                --input-type=dir \
                --chdir=pkg \
                --output-type=deb \
                --vendor="Grafana Labs" \
                --url=https://grafana.com \
                --maintainer=contact@grafana.com \
                --version="${debVersion}" \
                --package="${filename}" \
                --config-files=/etc/default/grafana-server \
                --config-files=/etc/init.d/grafana-server \
                --config-files=/usr/lib/systemd/system/grafana-server.service \
                --after-install="${tree}/packaging/deb/control/postinst" \
                --before-remove="${tree}/packaging/deb/control/prerm" \
                --depends=adduser \
                --architecture="${pkgArch}" \
                --description=Grafana \
                --license="AGPLv3" \
                --name="${debPkgName}" \
                --deb-no-default-config-files \
                --deb-compression xz \
                .
            '';
            installPhase = ''
              mkdir -p $out
              cp ${filename} $out/${filename}
            '';
          };

        # .rpm package assembly.
        mkRpm =
          {
            goos,
            goarch,
            goarm ? null,
            ...
          }:
          let
            tree = mkPkgTree { inherit goos goarch goarm; };
            archLabel = mkArchLabel { inherit goarch goarm; };
            # Strip v prefix, replace + with ^ (matches build-rpm.sh rpmVersion logic).
            rpmVersion = builtins.replaceStrings [ "+" ] [ "^" ] (nixpkgs.lib.removePrefix "v" grafanaVersion);
            pkgArch = if goarch == "arm" then "armhf" else goarch;
            filename = "grafana_${grafanaVersion}_${buildNumber}_${goos}_${archLabel}.rpm";
          in
          pkgs.stdenv.mkDerivation {
            name = filename;
            nativeBuildInputs = [ pkgs.fpm ];
            dontUnpack = true;
            buildPhase = ''
              mkdir -p pkg/usr/sbin
              mkdir -p pkg/usr/share/grafana
              mkdir -p pkg/etc/sysconfig pkg/etc/grafana
              mkdir -p pkg/usr/lib/systemd/system

              cp -r ${tree} pkg/usr/share/grafana
              chmod -R u+w pkg/usr/share/grafana

              cp ${tree}/packaging/wrappers/grafana        pkg/usr/sbin/grafana
              cp ${tree}/packaging/wrappers/grafana-server pkg/usr/sbin/grafana-server
              cp ${tree}/packaging/wrappers/grafana-cli    pkg/usr/sbin/grafana-cli
              chmod 0755 pkg/usr/sbin/grafana pkg/usr/sbin/grafana-server pkg/usr/sbin/grafana-cli

              cp ${tree}/packaging/rpm/sysconfig/grafana-server       pkg/etc/sysconfig/grafana-server
              cp ${tree}/packaging/rpm/systemd/grafana-server.service pkg/usr/lib/systemd/system/grafana-server.service
              chmod 0644 pkg/etc/sysconfig/grafana-server

              fpm \
                --input-type=dir \
                --chdir=pkg \
                --output-type=rpm \
                --vendor="Grafana Labs" \
                --url=https://grafana.com \
                --maintainer=contact@grafana.com \
                --version="${rpmVersion}" \
                --package="${filename}" \
                --config-files=/etc/sysconfig/grafana-server \
                --config-files=/usr/lib/systemd/system/grafana-server.service \
                --after-install="${tree}/packaging/rpm/control/postinst" \
                --depends=/sbin/service \
                --architecture="${pkgArch}" \
                --description=Grafana \
                --license="AGPLv3" \
                --name="grafana" \
                --rpm-posttrans="${tree}/packaging/rpm/control/posttrans" \
                --rpm-digest=sha256 \
                --rpm-compression xzmt \
                --rpm-user root \
                --rpm-group root \
                .
            '';
            installPhase = ''
              mkdir -p $out
              cp ${filename} $out/${filename}
            '';
          };
      in
      {
        packages =
          builtins.listToAttrs (
            map (t: {
              name = backendTargetName t;
              value = mkBackend t;
            }) targets
          )
          // {
            frontend = mkFrontend;
          }
          // builtins.listToAttrs (
            map (t: {
              name = targzTargetName t;
              value = mkTargz t;
            }) targets
          )
          // builtins.listToAttrs (
            map (t: {
              name = debTargetName t;
              value = mkDeb t;
            }) debTargets
          )
          // builtins.listToAttrs (
            map (t: {
              name = rpmTargetName t;
              value = mkRpm t;
            }) rpmTargets
          );
      }
    );
}
