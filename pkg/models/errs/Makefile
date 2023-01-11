SRCS=$(wildcard *.hcl)
OBJS=$(SRCS:.hcl=.gen.go)

all: $(OBJS)

%.gen.go: %.hcl errutil.tmpl
	eish generate --source=$< --template=./errutil.tmpl --package=errs > $@
