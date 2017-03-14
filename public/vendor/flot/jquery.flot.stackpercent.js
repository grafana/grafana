(function ($) {
    var options = {
        series: {
            stackpercent: null
        } // or number/string
    };

    function init(plot) {

        // will be built up dynamically as a hash from x-value, or y-value if horizontal
        var stackBases = {};
        var processed = false;
        var stackSums = {};

        //set percentage for stacked chart
        function processRawData(plot, series, data, datapoints) {
            if (!processed) {
                processed = true;
                stackSums = getStackSums(plot.getData());
            }
			if (series.stackpercent == true) {
				var num = data.length;
				series.percents = [];
				var key_idx = 0;
				var value_idx = 1;
				if (series.bars && series.bars.horizontal && series.bars.horizontal === true) {
					key_idx = 1;
					value_idx = 0;
				}
				for (var j = 0; j < num; j++) {
					var sum = stackSums[data[j][key_idx] + ""];
					if (sum > 0) {
						series.percents.push(data[j][value_idx] * 100 / sum);
					} else {
						series.percents.push(0);
					}
				}
			}
        }

        //calculate summary
        function getStackSums(_data) {
            var data_len = _data.length;
            var sums = {};
            if (data_len > 0) {
                //caculate summary
                for (var i = 0; i < data_len; i++) {
                    if (_data[i].stackpercent) {
						var key_idx = 0;
						var value_idx = 1;
						if (_data[i].bars && _data[i].bars.horizontal && _data[i].bars.horizontal === true) {
							key_idx = 1;
							value_idx = 0;
						}
                        var num = _data[i].data.length;
                        for (var j = 0; j < num; j++) {
                            var value = 0;
                            if (_data[i].data[j][1] != null) {
                                value = _data[i].data[j][value_idx];
                            }
                            if (sums[_data[i].data[j][key_idx] + ""]) {
                                sums[_data[i].data[j][key_idx] + ""] += value;
                            } else {
                                sums[_data[i].data[j][key_idx] + ""] = value;
                            }

                        }
                    }
                }
            }
            return sums;
        }

        function stackData(plot, s, datapoints) {
            if (!s.stackpercent) return;
            if (!processed) {
                stackSums = getStackSums(plot.getData());
            }
            var newPoints = [];


			var key_idx = 0;
			var value_idx = 1;
			if (s.bars && s.bars.horizontal && s.bars.horizontal === true) {
				key_idx = 1;
				value_idx = 0;
			}

			for (var i = 0; i < datapoints.points.length; i += 3) {
				// note that the values need to be turned into absolute y-values.
				// in other words, if you were to stack (x, y1), (x, y2), and (x, y3),
				// (each from different series, which is where stackBases comes in),
				// you'd want the new points to be (x, y1, 0), (x, y1+y2, y1), (x, y1+y2+y3, y1+y2)
				// generally, (x, thisValue + (base up to this point), + (base up to this point))
				if (!stackBases[datapoints.points[i + key_idx]]) {
					stackBases[datapoints.points[i + key_idx]] = 0;
				}
				newPoints[i + key_idx] = datapoints.points[i + key_idx];
				newPoints[i + value_idx] = datapoints.points[i + value_idx] + stackBases[datapoints.points[i + key_idx]];
				newPoints[i + 2] = stackBases[datapoints.points[i + key_idx]];
				stackBases[datapoints.points[i + key_idx]] += datapoints.points[i + value_idx];
				// change points to percentage values
				// you may need to set yaxis:{ max = 100 }
				if ( stackSums[newPoints[i+key_idx]+""] > 0 ){
					newPoints[i + value_idx] = newPoints[i + value_idx] * 100 / stackSums[newPoints[i + key_idx] + ""];
					newPoints[i + 2] = newPoints[i + 2] * 100 / stackSums[newPoints[i + key_idx] + ""];
				} else {
					newPoints[i + value_idx] = 0;
					newPoints[i + 2] = 0;
				}
			}

            datapoints.points = newPoints;
        }

		plot.hooks.processRawData.push(processRawData);
        plot.hooks.processDatapoints.push(stackData);
    }

    $.plot.plugins.push({
        init: init,
        options: options,
        name: 'stackpercent',
        version: '0.1'
    });
})(jQuery);
