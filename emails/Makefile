build: clean build-mjml build-grunt

clean:
	rm -rf dist/
	mkdir dist/

build-mjml:
	npx mjml \
		--config.beautify true \
		--config.minify false \
		--config.validationLevel=strict \
		--config.keepComments=false \
		./templates/*.mjml --output ./dist/

build-grunt:
	npx grunt

.PHONY: clean build build-mjml build-grunt
