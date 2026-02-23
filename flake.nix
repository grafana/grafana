{
  description = "Dev environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-darwin" ];
      forEachSystem = f: nixpkgs.lib.genAttrs systems (system:
        f {
          pkgs = import nixpkgs { inherit system; };
        });
    in {
      devShells = forEachSystem ({ pkgs }: {
        default = pkgs.mkShell {
          buildInputs = [
            pkgs.go_1_25
            pkgs.nodejs_24
            pkgs.jq
            pkgs.git
          ];
        };
      });
    };
}
