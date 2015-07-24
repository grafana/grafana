# This Makefile pulls the latest oglematchers (with dependencies),
# rewrites the imports to match this location,
# and ensures that all the tests pass.

go: clean clone rewrite test

clean:
	rm -rf ogle*
	rm -rf reqtrace

clone:
	git clone https://github.com/jacobsa/ogletest.git && rm -rf ogletest/.git
	git clone https://github.com/jacobsa/oglemock.git && rm -rf oglemock/.git
	git clone https://github.com/jacobsa/oglematchers.git && rm -rf oglematchers/.git
	git clone https://github.com/jacobsa/reqtrace.git && rm -rf reqtrace/.git

rewrite:
	grep -rl --exclude Makefile 'github.com/jacobsa' . | xargs sed -i '' 's#github.com/jacobsa#github.com/smartystreets/assertions/internal#g'

test:
	go test github.com/smartystreets/assertions/...
