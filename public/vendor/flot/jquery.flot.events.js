/**
 * Flot plugin for adding 'events' to the plot.
 *
 * Events are small icons drawn onto the graph that represent something happening at that time.
 *
 * This plugin adds the following options to flot:
 *
 * options = {
 *      events: {
 *          levels: int   // number of hierarchy levels
 *          data: [],     // array of event objects
 *          types: []     // array of icons
 *          xaxis: int    // the x axis to attach events to
 *      }
 *  };
 *
 *
 * An event is a javascript object in the following form:
 *
 * {
 *      min: startTime,
 *      max: endTime,
 *      eventType: "type",
 *      title: "event title",
 *      description: "event description"
 * }
 *
 * Types is an array of javascript objects in the following form:
 *
 * types: [
 *     {
 *         eventType: "eventType",
 *         level: hierarchicalLevel,
 *         icon: {
               image: "eventImage1.png",
 *             width: 10,
 *             height: 10
 *         }
 *     }
 *  ]
 *
 * @author Joel Oughton
 */
(function($){
    function init(plot){
        var DEFAULT_ICON = {
            icon: "icon-caret-up",
            size: 20,
            width: 19,
            height: 10
        };

        var _events = [], _types, _eventsEnabled = false;

        plot.getEvents = function(){
            return _events;
        };

        plot.hideEvents = function(levelRange){

            $.each(_events, function(index, event){
                if (_withinHierarchy(event.level(), levelRange)) {
                    event.visual().getObject().hide();
                }
            });

        };

        plot.showEvents = function(levelRange){
            plot.hideEvents();

            $.each(_events, function(index, event){
                if (!_withinHierarchy(event.level(), levelRange)) {
                    event.hide();
                }
            });

            _drawEvents();
        };

        plot.hooks.processOptions.push(function(plot, options){
            // enable the plugin
            if (options.events.data != null) {
                _eventsEnabled = true;
            }
        });

        plot.hooks.draw.push(function(plot, canvascontext){
            var options = plot.getOptions();
            var xaxis = plot.getXAxes()[options.events.xaxis - 1];

            if (_eventsEnabled) {

                // check for first run
                if (_events.length < 1) {

                    // check for clustering
                    if (options.events.clustering) {
                        var ed = _clusterEvents(options.events.types, options.events.data, xaxis.max - xaxis.min);
                        _types = ed.types;
                        _setupEvents(ed.data);
                    } else {
                        _types = options.events.types;
                        _setupEvents(options.events.data);
                    }

                } else {
                    /*if (options.events.clustering) {
                        _clearEvents();
                        var ed = _clusterEvents(options.events.types, options.events.data, xaxis.max - xaxis.min);
                        _types = ed.types;
                        _setupEvents(ed.data);
                    }*/
                    _updateEvents();
                }
            }

            _drawEvents();
        });

        var _drawEvents = function() {
            var o = plot.getPlotOffset();
            var pleft = o.left, pright = plot.width() - o.right;

            $.each(_events, function(index, event){

                // check event is inside the graph range and inside the hierarchy level
                if (_insidePlot(event.getOptions().min) &&
                    !event.isHidden()) {
                    event.visual().draw();
                }  else {
                    event.visual().getObject().hide();
                }
            });

            _identicalStarts();
            _overlaps();
        };

        var _withinHierarchy = function(level, levelRange){
            var range = {};

            if (!levelRange) {
                range.start = 0;
                range.end = _events.length - 1;
            } else {
                range.start = (levelRange.min == undefined) ? 0 : levelRange.min;
                range.end = (levelRange.max == undefined) ? _events.length - 1 : levelRange.max;
            }

            if (level >= range.start && level <= range.end) {
                return true;
            }
            return false;
        };

        var _clearEvents = function(){
            $.each(_events, function(index, val) {
                val.visual().clear();
            });

            _events = [];
        };

        var _updateEvents = function() {
            var o = plot.getPlotOffset(), left, top;
            var xaxis = plot.getXAxes()[plot.getOptions().events.xaxis - 1];

            $.each(_events, function(index, event) {
                top = o.top + plot.height() - event.visual().height();
                left = xaxis.p2c(event.getOptions().min) + o.left - event.visual().width() / 2;

                event.visual().moveTo({ top: top, left: left });
            });
        };

        var _showTooltip = function(x, y, event){
            /*
            var tooltip = $('<div id="tooltip" class=""></div>').appendTo('body').fadeIn(200);

            $('<div id="title">' + event.title + '</div>').appendTo(tooltip);
            $('<div id="type">Type: ' + event.eventType + '</div>').appendTo(tooltip);
            $('<div id="description">' + event.description + '</div>').appendTo(tooltip);

            tooltip.css({
                top: y - tooltip.height() - 5,
                left: x
            });
            console.log(tooltip);
            */

          // grafana addition
            var $tooltip = $('<div id="tooltip" annotation-tooltip>');
            if (event) {
                $tooltip
                    .html(event.description)
                    .place_tt(x, y, {offset: 10, compile: true, scopeData: {event: event}});
            } else {
                $tooltip.remove();
            }
        };

        var _setupEvents = function(events){

            $.each(events, function(index, event){
                var level = (plot.getOptions().events.levels == null || !_types || !_types[event.eventType]) ? 0 : _types[event.eventType].level;

                if (level > plot.getOptions().events.levels) {
                    throw "A type's level has exceeded the maximum. Level=" +
                    level +
                    ", Max levels:" +
                    (plot.getOptions().events.levels);
                }

                _events.push(new VisualEvent(event, _buildDiv(event), level));
            });

            _events.sort(compareEvents);
        };

        var _identicalStarts = function() {
            var ranges = [], range = {}, event, prev, offset = 0;

            $.each(_events, function(index, val) {

                if (prev) {
                    if (val.getOptions().min == prev.getOptions().min) {

                        if (!range.min) {
                            range.min = index;
                        }
                        range.max = index;
                    } else {
                        if (range.min) {
                            ranges.push(range);
                            range = {};
                        }
                    }
                }

                prev = val;
            });

            if (range.min) {
                ranges.push(range);
            }

            $.each(ranges, function(index, val) {
                var removed = _events.splice(val.min - offset, val.max - val.min + 1);

                $.each(removed, function(index, val) {
                    val.visual().clear();
                });

                offset += val.max - val.min + 1;
            });
        };

        var _overlaps = function() {
            var xaxis = plot.getXAxes()[plot.getOptions().events.xaxis - 1];
            var range, diff, cmid, pmid, left = 0, right = -1;
            pright = plot.width() - plot.getPlotOffset().right;

            // coverts a clump of events into a single vertical line
            var processClump = function() {
                // find the middle x value
                pmid = _events[right].getOptions().min -
                    (_events[right].getOptions().min - _events[left].getOptions().min) / 2;

                cmid = xaxis.p2c(pmid);

                // hide the events between the discovered range
                while (left <= right) {
                    _events[left++].visual().getObject().hide();
                }

                // draw a vertical line in the middle of where they are
                if (_insidePlot(pmid)) {
                    _drawLine('#000', 1, { x: cmid, y: 0 }, { x: cmid, y: plot.height() });

                }
            };

            if (xaxis.min && xaxis.max) {
                range = xaxis.max - xaxis.min;

                for (var i = 1; i < _events.length; i++) {
                    diff = _events[i].getOptions().min - _events[i - 1].getOptions().min;

                    if (diff / range > 0.007) {  //enough variance
                        // has a clump has been found
                        if (right != -1) {
                            //processClump();
                        }
                        right = -1;
                        left = i;
                    } else {    // not enough variance
                        right = i;
                        // handle to final case
                        if (i == _events.length - 1) {
                            //processClump();
                        }
                    }
                }
            }
        };

        var _buildDiv = function(event){
            //var po = plot.pointOffset({ x: 450, y: 1});
            var container = plot.getPlaceholder(), o = plot.getPlotOffset(), yaxis,
            xaxis = plot.getXAxes()[plot.getOptions().events.xaxis - 1], axes = plot.getAxes();
            var top, left, div, icon, level, drawableEvent;

            // determine the y axis used
            if (axes.yaxis && axes.yaxis.used) yaxis = axes.yaxis;
            if (axes.yaxis2 && axes.yaxis2.used) yaxis = axes.yaxis2;

            // use the default icon and level
            if (_types == null || !_types[event.eventType] || !_types[event.eventType].icon) {
                icon = DEFAULT_ICON;
                level = 0;
            } else {
                icon = _types[event.eventType].icon;
                level = _types[event.eventType].level;
            }

            div = $('<i style="position:absolute" class="'+icon.icon+'"></i>').appendTo(container);

            top = o.top + plot.height() - icon.size + 1;
            left = xaxis.p2c(event.min) + o.left - icon.size / 2;

            div.css({
                left: left + 'px',
                top: top,
                color: icon.color,
                "text-shadow" : "1px 1px "+icon.outline+", -1px -1px "+icon.outline+", -1px 1px "+icon.outline+", 1px -1px "+icon.outline,
                'font-size': icon['size']+'px',
            });
            div.hide();
            div.data({
                "event": event
            });
            div.hover(
            // mouseenter
            function(){
                var pos = $(this).offset();

                _showTooltip(pos.left + $(this).width() / 2, pos.top, $(this).data("event"));
            },
            // mouseleave
            function(){
                //$(this).data("bouncing", false);
                $('#tooltip').remove();
                plot.clearSelection();
            });

            drawableEvent = new DrawableEvent(
                div,
                function(obj){
                    obj.show();
                },
                function(obj){
                    obj.remove();
                },
                function(obj, position){
                    obj.css({
                        top: position.top,
                        left: position.left
                    });
                },
                left, top, div.width(), div.height());

            return drawableEvent;
        };

        var _getEventsAtPos = function(x, y){
            var found = [], left, top, width, height;

            $.each(_events, function(index, val){

                left = val.div.offset().left;
                top = val.div.offset().top;
                width = val.div.width();
                height = val.div.height();

                if (x >= left && x <= left + width && y >= top && y <= top + height) {
                    found.push(val);
                }

                return found;
            });
        };

        var _insidePlot = function(x) {
            var xaxis = plot.getXAxes()[plot.getOptions().events.xaxis - 1];
            var xc = xaxis.p2c(x);

            return xc > 0 && xc < xaxis.p2c(xaxis.max);
        };

        var _drawLine = function(color, lineWidth, from, to) {
            var ctx = plot.getCanvas().getContext("2d");
            var plotOffset = plot.getPlotOffset();

            ctx.save();
            ctx.translate(plotOffset.left, plotOffset.top);

            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            ctx.stroke();

            ctx.restore();
        };


        /**
         * Runs over the given 2d array of event objects and returns an object
         * containing:
         *
         * {
         *      types {},   // An array containing all the different event types
         *      data [],    // An array of the clustered events
         * }
         *
         * @param {Object} types
         *          an object containing event types
         * @param {Object} events
         *          an array of event to cluster
         * @param {Object} range
         *          the current graph range
         */
        var _clusterEvents = function(types, events, range) {
            //TODO: support custom types
            var groups, clusters = [], newEvents = [];

            // split into same evenType groups
            groups = _groupEvents(events);

            $.each(groups.eventTypes, function(index, val) {
                clusters.push(_varianceAlgorithm(groups.groupedEvents[val], 1, range));
            });

            // summarise clusters
            $.each(clusters, function(index, eventType) {

                // each cluser of each event type
                $.each(eventType, function(index, cluster) {

                    var newEvent = {
                        min: cluster[0].min,
                        max: cluster[cluster.length - 1].min,    //TODO: needs to be max of end event if it exists
                        eventType: cluster[0].eventType + ",cluster",
                        title: "Cluster of: " + cluster[0].title,
                        description: cluster[0].description + ", Number of events in the cluster: " + cluster.length
                    };

                    newEvents.push(newEvent);
                });
            });

            return { types: types, data: newEvents };
        };

        /**
         * Runs over the given 2d array of event objects and returns an object
         * containing:
         *
         * {
         *      eventTypes [],      // An array containing all the different event types
         *      groupedEvents {},   // An object containing all the grouped events
         * }
         *
         * @param {Object} events
         *          an array of event objects
         */
        var _groupEvents = function(events) {
            var eventTypes = [], groupedEvents = {};

            $.each(events, function(index, val) {
                if (!groupedEvents[val.eventType]) {
                    groupedEvents[val.eventType] = [];
                    eventTypes.push(val.eventType);
                }

                groupedEvents[val.eventType].push(val);
            });

            return { eventTypes: eventTypes, groupedEvents: groupedEvents };
        };

        /**
         * Runs over the given 2d array of event objects and returns a 3d array of
         * the same events,but clustered into groups with similar x deltas.
         *
         * This function assumes that the events are related. So it must be run on
         * each set of related events.
         *
         * @param {Object} events
         *          an array of event objects
         * @param {Object} sens
         *          a measure of the level of grouping tolerance
         * @param {Object} space
         *          the size of the space we have to place clusters within
         */
        var _varianceAlgorithm = function(events, sens, space) {
            var cluster, clusters = [], sum = 0, avg, density;

            // find the average x delta
            for (var i = 1; i < events.length - 1; i++) {
                sum += events[i].min - events[i - 1].min;
            }
            avg = sum / (events.length - 2);

            // first point
            cluster = [ events[0] ];

            // middle points
            for (var i = 1; i < events.length; i++) {
                var leftDiff = events[i].min - events[i - 1].min;

                density = leftDiff / space;

                if (leftDiff > avg * sens && density > 0.05) {
                    clusters.push(cluster);
                    cluster = [ events[i] ];
                } else {
                    cluster.push(events[i]);
                }
            }

            clusters.push(cluster);

            return clusters;
        };
    }

    var options = {
        events: {
            levels: null,
            data: null,
            types: null,
            xaxis: 1,
            clustering: false
        }
    };

    $.plot.plugins.push({
        init: init,
        options: options,
        name: "events",
        version: "0.20"
    });

    /**
     * A class that allows for the drawing an remove of some object
     *
     * @param {Object} object
     *          the drawable object
     * @param {Object} drawFunc
     *          the draw function
     * @param {Object} clearFunc
     *          the clear function
     */
    function DrawableEvent(object, drawFunc, clearFunc, moveFunc, left, top, width, height){
        var _object = object, _drawFunc = drawFunc, _clearFunc = clearFunc, _moveFunc = moveFunc,
        _position = { left: left, top: top }, _width = width, _height = height;

        this.width = function() { return _width; };
        this.height = function() { return _height };
        this.position = function() { return _position; };
        this.draw = function() { _drawFunc(_object); };
        this.clear = function() { _clearFunc(_object); };
        this.getObject = function() { return _object; };
        this.moveTo = function(position) {
            _position = position;
            _moveFunc(_object, _position);
        };
    }

    /**
     * Event class that stores options (eventType, min, max, title, description) and the object to draw.
     *
     * @param {Object} options
     * @param {Object} drawableEvent
     */
    function VisualEvent(options, drawableEvent, level){
        var _parent, _options = options, _drawableEvent = drawableEvent,
            _level = level, _hidden = false;

        this.visual = function() { return _drawableEvent; }
        this.level = function() { return _level; };
        this.getOptions = function() { return _options; };
        this.getParent = function() { return _parent; };

        this.isHidden = function() { return _hidden; };
        this.hide = function() { _hidden = true; };
        this.unhide = function() { _hidden = false; };
    }

    function compareEvents(a, b) {
        var ao = a.getOptions(), bo = b.getOptions();

        if (ao.min > bo.min) return 1;
        if (ao.min < bo.min) return -1;
        return 0;
    };
})(jQuery);
