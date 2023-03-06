build: build-html build-txt

build-html:
	npx mjml \
		--config.beautify true \
		--config.minify false \
		--config.validationLevel=strict \
		--config.keepComments=false \
		./templates/*.mjml --output ../public/emails/

build-txt:
	npx grunt

.PHONY: build build-html build-txt
