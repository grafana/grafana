{
  system ? builtins.currentSystem,
  unitShard ? "1/8",
  sqlShard ? "13/16",
}:
let
  flake = builtins.getFlake "git+file://${toString ../.}?shallow=1";
  pkgs = flake.inputs.nixpkgs.legacyPackages.${system};
  backend = flake.packages.${system}.backend;
  mkTest =
    name: command:
    backend.overrideAttrs (old: {
      pname = "grafana-benchmark-${name}";
      nativeBuildInputs = old.nativeBuildInputs ++ [
        pkgs.git
        pkgs.jq
      ];
      doInstallCheck = false;
      dontFixup = true;
      allowGoReference = true;
      postConfigure = ''
        if [ -w /grafana-go-cache ]; then
          export GOCACHE=/grafana-go-cache
        fi
      '';
      buildPhase = ''
        runHook preBuild
        export UNIT_SHARD=${pkgs.lib.escapeShellArg unitShard}
        export SQL_SHARD=${pkgs.lib.escapeShellArg sqlShard}
        export GOFLAGS="''${GOFLAGS//-trimpath/}"
        ${command}
        runHook postBuild
      '';
      installPhase = ''
        runHook preInstall
        test -e "$out"
        runHook postInstall
      '';
    });
in
{
  unit = mkTest "unit" ''
    mkdir -p "$out"
    bash ${./nix-test-benchmark.sh} unit "$out/summary.json"
  '';
  sql = mkTest "sql" ''
    bash ${./nix-test-benchmark.sh} compile "$out"
  '';
}
