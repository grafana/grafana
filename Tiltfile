# point Tilt at the existing docker-compose configuration.
docker_compose("./tilt-docker-compose.yaml")

local_resource(
  'backend-build',
  'make GO_BUILD_DEV=1 build-backend',
  deps=[
    './pkg',
    './apps',
    './kinds',
    './kindsv2',
    './local',
    './scripts',
    './conf',
    './go.sum',
    './go.mod',
  ],
  allow_parallel=True
)

local_resource(
  'frontend-build',
  cmd='rm -rf public/build/assets-manifest.json',
  serve_cmd='yarn start:noLint',
  deps=[
    'package.json',
  ],
  readiness_probe=probe(
    initial_delay_secs=10,
    period_secs=1,
    failure_threshold=10,
    exec=exec_action(["bash", "-c", "cat public/build/assets-manifest.json | grep -n -A 11 entrypoints"])
  ),
  allow_parallel=True
)

docker_build('grafana-backend-api', '.',
  dockerfile='tilt-backend-base.dockerfile',
  only=[
    './bin',
    './conf',
    './fake-assets-manifest.json'
  ],
  live_update = [
    sync('./bin', '/grafana/bin'),
    sync('./conf', '/grafana/conf'),
    restart_container()
  ]
)

docker_build('grafana-frontend-service', '.',
  dockerfile='tilt-backend-base.dockerfile',
  only=[
    './bin',
    './conf',
    './public/build/assets-manifest.json',
    './fake-assets-manifest.json'
  ],
  live_update = [
    sync('./bin', '/grafana/bin'),
    sync('./conf', '/grafana/conf'),
    sync('./public/build/assets-manifest.json', '/grafana/public/build/assets-manifest.json'),
    restart_container()
  ]
)

docker_build('grafana-frontend-cdn', '.',
  dockerfile='tilt-frontend-cdn.dockerfile',
  only=[
    './nginx.conf',
  ]
)
