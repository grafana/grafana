print("""
                    ▓███▄
                  ▐███████
              ▄▄████████████████████
    ▐███████████████████████████████
    ▐█████████████▀▀          ▀▀█████▄
     ██████████▀                  ▀███▌
      ████████          ▄▄▄▄▄        ███
      ▐█████▌       ▄▓██████████▓▄    ██▌
      ██████       ████▀▀  ▀▀██████▄   ██
    ▄██████▌      ███          ▀█████
  ▓████████▌      ██             ████▌
 ███████████      ██▌            █████
 ▀██████████▌      ▀██▄          █████▄
    ▀█████████        ▀▀▀▀      ███████▌
        ▀███████▄             ▄████████▀
          █████████▄▄▄▄  ▄▄▄███████▀
          ███████████████████████▀
          ██████████████████████
          ▐██▀▀▀        ▀██████
                             ▀▀
""")


local("devenv/kind/kind-with-registry.sh")

k8s_yaml('devenv/velero/00-minio-deployment.yaml')
k8s_resource(workload='minio', port_forwards=9000)

local("devenv/velero/setup.sh")

os = str(local('uname -s')).strip().lower()
k8s_yaml(kustomize('devenv/aggregate-to-kind/%s' % os))


