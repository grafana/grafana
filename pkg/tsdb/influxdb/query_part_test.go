package influxdb

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestInfluxdbQueryPart(t *testing.T) {
	Convey("Influxdb query part builder", t, func() {

		Convey("can build query", func() {
		})

		Convey("empty queries should return error", func() {

		})
	})
}

/*
  describe('series with mesurement only', () => {
    it('should handle nested function parts', () => {
      var part = queryPart.create({
        type: 'derivative',
        params: ['10s'],
      });

      expect(part.text).to.be('derivative(10s)');
      expect(part.render('mean(value)')).to.be('derivative(mean(value), 10s)');
    });

    it('should nest spread function', () => {
      var part = queryPart.create({
        type: 'spread'
      });

      expect(part.text).to.be('spread()');
      expect(part.render('value')).to.be('spread(value)');
    });

    it('should handle suffirx parts', () => {
      var part = queryPart.create({
        type: 'math',
        params: ['/ 100'],
      });

      expect(part.text).to.be('math(/ 100)');
      expect(part.render('mean(value)')).to.be('mean(value) / 100');
    });

    it('should handle alias parts', () => {
      var part = queryPart.create({
        type: 'alias',
        params: ['test'],
      });

      expect(part.text).to.be('alias(test)');
      expect(part.render('mean(value)')).to.be('mean(value) AS "test"');
    });

  });
*/
