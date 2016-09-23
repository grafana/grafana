/*
Flot plugin for highlighting series.

	highlightSeries: {
		autoHighlight: true (default) or false,
		color: color
	}

If "autoHighlight" is true (the default) and the plot's "hoverable" setting is true
series are highlighted when the mouse hovers near an item.
"color" is the color of the highlighted series (default is "red").

The plugin also adds two public methods that allow you to highlight and
unhighlight a series manually by specifying a series by label, index or object.

	- highlightSeries(series, [color])

	- unHighlightSeries(series)
*/

(function ($) {
	var log = (function () {
		var out = $("#out");
		return function () {
			if (!arguments) { return; }
			var msg = Array.prototype.slice.call(arguments).join(" ");
			if (!out.length) {
				out = $("#out");
			}
			if (out.length) {
				out.text(msg);
			}
		};
	})();

	var options = {
		highlightSeries: {
			autoHighlight: true,
			color: "black",
			_optimized: true,
			_debug: false
		}
	};

	function init(plot) {
		var highlightedSeries = {};
		var originalColors = {};
		var originalLines = {};

		function highlightSeries(series, color) {
			var
				seriesAndIndex = getSeriesAndIndex(series),
				options = plot.getOptions().highlightSeries,
                start;

			series = seriesAndIndex[1];

			highlightedSeries[seriesAndIndex[0]] = series;
			if (options.color) {
				originalColors[seriesAndIndex[0]] = series.color;
				series.color = color || options.color;
			}
			if (options.lines) {
				var lineWidth = series.lines.lineWidth || plot.getOptions().series.lines.lineWidth;
				switch (options.lines.lineWidth[0]) {
					case '+':
						lineWidth += parseInt(options.lines.lineWidth.slice(1), 10);
						break;
					case '-':
						lineWidth -= parseInt(options.lines.lineWidth.slice(1), 10);
						break;
					default:
						lineWidth = parseInt(options.lines.lineWidth, 10);
						break;
				}
				originalLines[seriesAndIndex[0]] = series.lines;
				var lineOptions = jQuery.extend(true, {}, series.lines, options.lines);
				lineOptions.lineWidth = lineWidth;
				series.lines = lineOptions;
			}

			if (options._debug) { start = new Date(); }
			if (options._optimized) {
				if (plot.drawOverlay && options._debug) {
					plot.drawOverlay();
				}
				else {
					plot.triggerRedrawOverlay();
				}
			}
			else {
				plot.draw();
			}
			if (options._debug) { 
				log("Time taken to highlight:", (new Date()).getTime() - start.getTime(), "ms");
			}
		}
		plot.highlightSeries = highlightSeries;

		function unHighlightSeries(series) {
			var
				seriesAndIndex = getSeriesAndIndex(series),
				options = plot.getOptions().highlightSeries,
                start;

			if (originalColors[seriesAndIndex[0]]) {
				seriesAndIndex[1].color = originalColors[seriesAndIndex[0]];
			}
			if (originalLines[seriesAndIndex[0]]) {
				seriesAndIndex[1].lines = originalLines[seriesAndIndex[0]];
			}

			if (options._debug) { start = new Date(); }
			if (options._optimized) {
				delete highlightedSeries[seriesAndIndex[0]];
				if (plot.drawOverlay && options._debug) {
					plot.drawOverlay();
				}
				else {
					plot.triggerRedrawOverlay();
				}
			}
			else {
				plot.draw();
			}
			if (options._debug) { 
				log("Time taken to un-highlight:", (new Date()).getTime() - start.getTime(), "ms");
			}
		}
		plot.unHighlightSeries = unHighlightSeries;

        var lastHighlighted = null;
        function handlePlotHover (evt, pos, item) {
            if (item && lastHighlighted !== item.series) {
                for(var seriesIndex in highlightedSeries) {
                    delete highlightedSeries[seriesIndex];
                }
                if (lastHighlighted) {
                    unHighlightSeries(lastHighlighted);
                }
                lastHighlighted = item.series;
                highlightSeries(item.series);
            }
            else if (!item && lastHighlighted) {
                unHighlightSeries(lastHighlighted);
                lastHighlighted = null;
            }
        }

		plot.hooks.bindEvents.push(function (plot, eventHolder) {
			if (!plot.getOptions().highlightSeries.autoHighlight) {
				return;
			}
			plot.getPlaceholder().bind("plothover", handlePlotHover);
		});

		plot.hooks.shutdown.push(function (plot) {
			plot.getPlaceholder().unbind("plothover", handlePlotHover);
		});

		function getSeriesAndIndex(series) {
			var allPlotSeries = plot.getData();
			if (typeof series == "number") {
				return [series, allPlotSeries[series]];
			}
			else {
				for (var ii = 0; ii < allPlotSeries.length; ii++) {
					var plotSeries = allPlotSeries[ii];
					if (
						plotSeries === series ||
                        plotSeries.label === series ||
                        (series.label && plotSeries.label === series.label)
					) {
						return [ii, plotSeries];
					}
				}
			}
		}

		plot.hooks.drawOverlay.push(function (plot, ctx) {
			for(var seriesIndex in highlightedSeries) {
				plot.drawSeries(highlightedSeries[seriesIndex], ctx);
			}
		});
	}

	$.plot.plugins.push({
		init: init,
		options: options,
		name: "highlightSeries",
		version: "1.1"
	});
})(jQuery);
