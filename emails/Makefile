build: build-html build-txt

build-html:
	npx mjml \
		--config.beautify true \
		--config.minify false \
		--config.keepComments=false \
		--config.validationLevel=strict \
		--input templates/*.mjml \
		--output ../public/emails/

build-txt:
	npx grunt

.PHONY: build build-html build-txt
