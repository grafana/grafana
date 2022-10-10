load(
    'scripts/drone/steps/lib.star',
    'swagger_gen_step',
)

load(
    'scripts/drone/utils/utils.star',
    'pipeline',
)

def swagger_gen(trigger, ver_mode, edition):
	test_steps = [
		swagger_gen_step(edition="oss", ver_mode=ver_mode)
	]

	return pipeline(
		name='{}-swagger-gen'.format(ver_mode), edition=edition, trigger=trigger, services=[], steps=test_steps,
	)
