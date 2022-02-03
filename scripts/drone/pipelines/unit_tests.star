load('scripts/drone/init/init.star', 'enterprise2_suffix', 'build_image')

def test_backend_step(edition):
    return {
        'name': 'test-backend' + enterprise2_suffix(edition),
        'image': build_image,
        'depends_on': [
            'initialize',
        ],
        'commands': [
            './bin/grabpl test-backend --edition {}'.format(edition),
        ],
    }


def test_backend_integration_step(edition):
    return {
        'name': 'test-backend-integration' + enterprise2_suffix(edition),
        'image': build_image,
        'depends_on': [
            'initialize',
        ],
        'commands': [
            './bin/grabpl integration-tests --edition {}'.format(edition),
        ],
    }

def test_frontend_step():
    return {
        'name': 'test-frontend',
        'image': build_image,
        'depends_on': [
            'initialize',
        ],
        'environment': {
            'TEST_MAX_WORKERS': '50%',
        },
        'commands': [
            'yarn run ci:test-frontend',
        ],
    }
