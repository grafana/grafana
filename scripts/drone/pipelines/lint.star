load('scripts/drone/init/init.star', 'enterprise2_suffix', 'curl_image', 'build_image')

def lint_drone_step():
    return {
        'name': 'lint-drone',
        'image': curl_image,
        'commands': [
            './bin/grabpl verify-drone',
        ],
        'depends_on': [
            'grabpl',
        ],
    }

def lint_backend_step(edition):
    return {
        'name': 'lint-backend' + enterprise2_suffix(edition),
        'image': build_image,
        'environment': {
            # We need CGO because of go-sqlite3
            'CGO_ENABLED': '1',
        },
        'depends_on': [
            'initialize',
        ],
        'commands': [
            # Don't use Make since it will re-download the linters
            './bin/grabpl lint-backend --edition {}'.format(edition),
        ],
    }

def lint_frontend_step():
    return {
        'name': 'lint-frontend',
        'image': build_image,
        'depends_on': [
            'initialize',
        ],
        'environment': {
            'TEST_MAX_WORKERS': '50%',
        },
        'commands': [
            'yarn run prettier:check',
            'yarn run lint',
            'yarn run i18n:compile', # TODO: right place for this?
            'yarn run typecheck',
        ],
    }

def shellcheck_step():
    return {
        'name': 'shellcheck',
        'image': build_image,
        'depends_on': [
            'initialize',
        ],
        'commands': [
            './bin/grabpl shellcheck',
        ],
    }

def codespell_step():
    return {
        'name': 'codespell',
        'image': build_image,
        'depends_on': [
            'initialize',
        ],
        'commands': [
            # Important: all words have to be in lowercase, and separated by "\n".
            'echo -e "unknwon\nreferer\nerrorstring\neror\niam\nwan" > words_to_ignore.txt',
            'codespell -I words_to_ignore.txt docs/',
            'rm words_to_ignore.txt',
        ],
    }
