load('scripts/drone/utils/var.star', 'build_image')

def validate_scuemata_step():
    return {
        'name': 'validate-scuemata',
        'image': build_image,
        'depends_on': [
            'build-backend',
        ],
        'commands': [
            './bin/linux-amd64/grafana-cli cue validate-schema --grafana-root .',
        ],
    }


def ensure_cuetsified_step():
    return {
        'name': 'ensure-cuetsified',
        'image': build_image,
        'depends_on': [
            'validate-scuemata',
        ],
        'commands': [
            '# Make sure the git tree is clean.',
            '# Stashing changes, since packages that were produced in build-backend step are needed.',
            'git stash',
            './bin/linux-amd64/grafana-cli cue gen-ts --grafana-root .',
            '# The above command generates Typescript files (*.gen.ts) from all appropriate .cue files.',
            '# It is required that the generated Typescript be in sync with the input CUE files.',
            '# ...Modulo eslint auto-fixes...:',
            'yarn run eslint . --ext .gen.ts --fix',
            '# If any filenames are emitted by the below script, run the generator command `grafana-cli cue gen-ts` locally and commit the result.',
            './scripts/clean-git-or-error.sh',
            '# Un-stash changes.',
            'git stash pop',
        ],
    }
