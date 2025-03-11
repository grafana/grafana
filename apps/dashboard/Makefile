.PHONY: generate
generate:
	@grafana-app-sdk generate \
		--source=./kinds/ \
		--gogenpath=../../pkg/apis \
		--tsgenpath=../../packages/grafana-schema/src/schema \
		--grouping=group \
		--defencoding=none \
		--genoperatorstate=false \
		--noschemasinmanifest

	# This is a workaround for SDK codegen not producing correct output for v0alpha1
	@rm ../../packages/grafana-schema/src/schema/dashboard/v0alpha1/types.spec.gen.ts
	@cp ./tshack/v0alpha1_spec_gen.ts ../../packages/grafana-schema/src/schema/dashboard/v0alpha1/types.spec.gen.ts

	# Same for v1alpha1
	@rm ../../packages/grafana-schema/src/schema/dashboard/v1alpha1/types.spec.gen.ts
	@cp ./tshack/v1alpha1_spec_gen.ts ../../packages/grafana-schema/src/schema/dashboard/v1alpha1/types.spec.gen.ts
