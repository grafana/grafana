load('scripts/drone/utils/var.star', 'build_image')
load('scripts/drone/init/init.star', 'enterprise2_suffix')
load('scripts/drone/vault.star', 'from_secret', 'github_token', 'gcp_upload_artifacts_key')

def grafana_server_step(edition, port=3001):
    package_file_pfx = ''
    if edition == 'enterprise2':
        package_file_pfx = 'grafana' + enterprise2_suffix(edition)
    elif edition == 'enterprise':
        package_file_pfx = 'grafana-' + edition

    environment = {
        'PORT': port,
        'ARCH': 'linux-amd64'
    }
    if package_file_pfx:
        environment['RUNDIR'] = 'scripts/grafana-server/tmp-{}'.format(package_file_pfx)

    return {
        'name': 'grafana-server' + enterprise2_suffix(edition),
        'image': build_image,
        'detach': True,
        'depends_on': [
            'build-plugins',
            'build-backend',
            'build-frontend',
            ],
        'environment': environment,
        'commands': [
            './scripts/grafana-server/start-server',
        ],
    }

def e2e_tests_step(suite, edition, port=3001, tries=None):
    cmd = './bin/grabpl e2e-tests --port {} --suite {}'.format(port, suite)
    if tries:
        cmd += ' --tries {}'.format(tries)
    return {
        'name': 'end-to-end-tests-{}'.format(suite) + enterprise2_suffix(edition),
        'image': 'cypress/included:9.3.1',
        'depends_on': [
            'grafana-server',
        ],
        'environment': {
            'HOST': 'grafana-server' + enterprise2_suffix(edition),
        },
        'commands': [
            'apt-get install -y netcat',
            cmd,
        ],
    }

def e2e_tests_artifacts(edition):
    return {
        'name': 'e2e-tests-artifacts-upload' + enterprise2_suffix(edition),
        'image': 'google/cloud-sdk:367.0.0',
        'depends_on': [
            'end-to-end-tests-dashboards-suite',
            'end-to-end-tests-panels-suite',
            'end-to-end-tests-smoke-tests-suite',
            'end-to-end-tests-various-suite',
        ],
        'when': {
            'status': [
                'success',
                'failure',
            ]
        },
        'environment': {
            'GCP_GRAFANA_UPLOAD_ARTIFACTS_KEY': from_secret('gcp_upload_artifacts_key'),
            'E2E_TEST_ARTIFACTS_BUCKET': 'releng-pipeline-artifacts-dev',
            'GITHUB_TOKEN': from_secret('github_token'),
        },
        'commands': [
            'apt-get update',
            'apt-get install -yq zip',
            'ls -lah ./e2e',
            'find ./e2e -type f -name "*.mp4"',
            'printenv GCP_GRAFANA_UPLOAD_ARTIFACTS_KEY > /tmp/gcpkey_upload_artifacts.json',
            'gcloud auth activate-service-account --key-file=/tmp/gcpkey_upload_artifacts.json',
            # we want to only include files in e2e folder that end with .spec.ts.mp4
            'find ./e2e -type f -name "*spec.ts.mp4" | zip e2e/videos.zip -@',
            'gsutil cp e2e/videos.zip gs://$${E2E_TEST_ARTIFACTS_BUCKET}/${DRONE_BUILD_NUMBER}/artifacts/videos/videos.zip',
            'export E2E_ARTIFACTS_VIDEO_ZIP=https://storage.googleapis.com/$${E2E_TEST_ARTIFACTS_BUCKET}/${DRONE_BUILD_NUMBER}/artifacts/videos/videos.zip',
            'echo "E2E Test artifacts uploaded to: $${E2E_ARTIFACTS_VIDEO_ZIP}"',
            'curl -X POST https://api.github.com/repos/${DRONE_REPO}/statuses/${DRONE_COMMIT_SHA} -H "Authorization: token $${GITHUB_TOKEN}" -d ' +
            '"{\\"state\\":\\"success\\",\\"target_url\\":\\"$${E2E_ARTIFACTS_VIDEO_ZIP}\\", \\"description\\": \\"Click on the details to download e2e recording videos\\", \\"context\\": \\"e2e_artifacts\\"}"',
            ],
    }

