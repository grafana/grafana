include $(GOROOT)/src/Make.inc


TARG=github.com/vdobler/chart
GOFILES=\
	chart.go\
	data.go\
	util.go\
	style.go\
	key.go\
	graphics.go\
	stat.go\
	time.go\
	strip.go\
	scatter.go\
	box.go\
	hist.go\
	bar.go\
	pie.go

include $(GOROOT)/src/Make.pkg

DRIVERS=\
	svg\
	txt\
	image


samplechart: samplecharts.go install drivers
	$(GC) -I. samplecharts.go
	$(LD) -L. -o samplecharts samplecharts.$(O)

format: $(GOFILES) samplecharts.go  
	gofmt -w $^
	for d in $(DRIVERS); do (cd $$d; make format); done

drivers:
	for d in $(DRIVERS); do (cd $$d; make install || exit 1) || exit 1; done

CLEAN:
	make clean
	for d in $(DRIVERS); do (cd $$d; make clean); done