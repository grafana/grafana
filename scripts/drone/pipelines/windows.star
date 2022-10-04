load(
    'scripts/drone/steps/lib.star',
    'grabpl_version',
    'wix_image',
    'identify_runner_step',
)

load(
    'scripts/drone/utils/utils.star',
    'pipeline',
)

load('scripts/drone/vault.star', 'from_secret', 'prerelease_bucket', 'github_token')

def windows(trigger, edition, ver_mode):
    init_cmds = []
    sfx = ''
    if edition in ('enterprise', 'enterprise2'):
        sfx = '-{}'.format(edition)
    else:
        init_cmds.extend([
            '$$ProgressPreference = "SilentlyContinue"',
            'Invoke-WebRequest https://grafana-downloads.storage.googleapis.com/grafana-build-pipeline/{}/windows/grabpl.exe -OutFile grabpl.exe'.format(
                grabpl_version),
        ])
    steps = [
        {
            'name': 'windows-init',
            'image': wix_image,
            'commands': init_cmds,
        },
    ]
    if (ver_mode == 'main' and (edition not in ('enterprise', 'enterprise2'))) or ver_mode in (
        'release', 'release-branch',
    ):
        bucket = '%PRERELEASE_BUCKET%/artifacts/downloads'
        if ver_mode == 'release':
            ver_part = '${DRONE_TAG}'
            dir = 'release'
        else:
            dir = 'main'
            bucket = 'grafana-downloads'
            build_no = 'DRONE_BUILD_NUMBER'
            ver_part = '--build-id $$env:{}'.format(build_no)
        installer_commands = [
            '$$gcpKey = $$env:GCP_KEY',
            '[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($$gcpKey)) > gcpkey.json',
            # gcloud fails to read the file unless converted with dos2unix
            'dos2unix gcpkey.json',
            'gcloud auth activate-service-account --key-file=gcpkey.json',
            'rm gcpkey.json',
            'cp C:\\App\\nssm-2.24.zip .',
        ]
        if (ver_mode == 'main' and (edition not in ('enterprise', 'enterprise2'))) or ver_mode in (
            'release',
        ):
            installer_commands.extend([
                '.\\grabpl.exe windows-installer --edition {} {}'.format(edition, ver_part),
                '$$fname = ((Get-Childitem grafana*.msi -name) -split "`n")[0]',
            ])
            if ver_mode == 'main':
                installer_commands.extend([
                    'gsutil cp $$fname gs://{}/{}/{}/'.format(bucket, edition, dir),
                    'gsutil cp "$$fname.sha256" gs://{}/{}/{}/'.format(bucket, edition, dir),
                ])
            else:
                installer_commands.extend([
                    'gsutil cp $$fname gs://{}/{}/{}/{}/'.format(bucket, ver_part, edition, dir),
                    'gsutil cp "$$fname.sha256" gs://{}/{}/{}/{}/'.format(bucket, ver_part, edition, dir),
                ])
        steps.append({
            'name': 'build-windows-installer',
            'image': wix_image,
            'depends_on': [
                'windows-init',
            ],
            'environment': {
                'GCP_KEY': from_secret('gcp_key'),
                'PRERELEASE_BUCKET': from_secret(prerelease_bucket),
                'GITHUB_TOKEN': from_secret('github_token')
            },
            'commands': installer_commands,
        })

    if edition in ('enterprise', 'enterprise2'):
        if ver_mode == 'release':
            committish = '${DRONE_TAG}'
        elif ver_mode == 'release-branch':
            committish = '$$env:DRONE_BRANCH'
        else:
            committish = '$$env:DRONE_COMMIT'
        # For enterprise, we have to clone both OSS and enterprise and merge the latter into the former
        download_grabpl_step_cmds = [
            '$$ProgressPreference = "SilentlyContinue"',
            'Invoke-WebRequest https://grafana-downloads.storage.googleapis.com/grafana-build-pipeline/{}/windows/grabpl.exe -OutFile grabpl.exe'.format(
                grabpl_version),
        ]
        clone_cmds = [
            'git clone "https://$$env:GITHUB_TOKEN@github.com/grafana/grafana-enterprise.git"',
        ]
        clone_cmds.extend([
            'cd grafana-enterprise',
            'git checkout {}'.format(committish),
        ])
        steps.insert(0, {
            'name': 'clone',
            'image': wix_image,
            'environment': {
                'GITHUB_TOKEN': from_secret(github_token),
            },
            'commands': download_grabpl_step_cmds + clone_cmds,
        })
        steps[1]['depends_on'] = [
            'clone',
        ]
        steps[1]['commands'].extend([
            # Need to move grafana-enterprise out of the way, so directory is empty and can be cloned into
            'cp -r grafana-enterprise C:\\App\\grafana-enterprise',
            'rm -r -force grafana-enterprise',
            'cp grabpl.exe C:\\App\\grabpl.exe',
            'rm -force grabpl.exe',
            'C:\\App\\grabpl.exe init-enterprise --github-token $$env:GITHUB_TOKEN C:\\App\\grafana-enterprise',
            'cp C:\\App\\grabpl.exe grabpl.exe',
        ])
        if 'environment' in steps[1]:
            steps[1]['environment'] + {'GITHUB_TOKEN': from_secret(github_token)}
        else:
            steps[1]['environment'] = {'GITHUB_TOKEN': from_secret(github_token)}

    return pipeline(
        name='main-windows', edition=edition, trigger=dict(trigger, repo=['grafana/grafana']),
        steps=[identify_runner_step('windows')] + steps,
        depends_on=['main-test-frontend', 'main-test-backend', 'main-build-e2e-publish', 'main-integration-tests'], platform='windows',
    )
