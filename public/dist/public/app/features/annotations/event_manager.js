import { each, filter, keys } from 'lodash';
import tinycolor from 'tinycolor2';
import { ALERTING_COLOR, DEFAULT_ANNOTATION_COLOR, NO_DATA_COLOR, OK_COLOR, PENDING_COLOR, REGION_FILL_ALPHA, } from '@grafana/ui';
var EventManager = /** @class */ (function () {
    function EventManager(panelCtrl) {
        this.panelCtrl = panelCtrl;
        this.event = null;
        this.editorOpen = false;
    }
    EventManager.prototype.editorClosed = function () {
        this.event = null;
        this.editorOpen = false;
        this.panelCtrl.render();
    };
    EventManager.prototype.editorOpened = function () {
        this.editorOpen = true;
    };
    EventManager.prototype.updateTime = function (range) {
        if (!this.event) {
            this.event = {};
            this.event.dashboardId = this.panelCtrl.dashboard.id;
            this.event.panelId = this.panelCtrl.panel.id;
        }
        // update time
        this.event.time = range.from;
        this.event.isRegion = false;
        if (range.to) {
            this.event.timeEnd = range.to;
            this.event.isRegion = true;
        }
        this.panelCtrl.render();
    };
    EventManager.prototype.editEvent = function (event, elem) {
        this.event = event;
        this.panelCtrl.render();
    };
    EventManager.prototype.addFlotEvents = function (annotations, flotOptions) {
        if (!this.event && annotations.length === 0) {
            return;
        }
        var types = {
            $__alerting: {
                color: ALERTING_COLOR,
                position: 'BOTTOM',
                markerSize: 5,
            },
            $__ok: {
                color: OK_COLOR,
                position: 'BOTTOM',
                markerSize: 5,
            },
            $__no_data: {
                color: NO_DATA_COLOR,
                position: 'BOTTOM',
                markerSize: 5,
            },
            $__pending: {
                color: PENDING_COLOR,
                position: 'BOTTOM',
                markerSize: 5,
            },
            $__editing: {
                color: DEFAULT_ANNOTATION_COLOR,
                position: 'BOTTOM',
                markerSize: 5,
            },
        };
        if (this.event) {
            if (this.event.isRegion) {
                annotations = [
                    {
                        isRegion: true,
                        min: this.event.time,
                        timeEnd: this.event.timeEnd,
                        text: this.event.text,
                        eventType: '$__editing',
                        editModel: this.event,
                    },
                ];
            }
            else {
                annotations = [
                    {
                        min: this.event.time,
                        text: this.event.text,
                        editModel: this.event,
                        eventType: '$__editing',
                    },
                ];
            }
        }
        else {
            // annotations from query
            for (var i = 0; i < annotations.length; i++) {
                var item = annotations[i];
                // add properties used by jquery flot events
                item.min = item.time;
                item.max = item.time;
                item.eventType = item.type;
                if (item.newState) {
                    item.eventType = '$__' + item.newState;
                    continue;
                }
                if (!types[item.type]) {
                    types[item.type] = {
                        color: item.color,
                        position: 'BOTTOM',
                        markerSize: 5,
                    };
                }
            }
        }
        var regions = getRegions(annotations);
        addRegionMarking(regions, flotOptions);
        var eventSectionHeight = 20;
        var eventSectionMargin = 7;
        flotOptions.grid.eventSectionHeight = eventSectionMargin;
        flotOptions.xaxis.eventSectionHeight = eventSectionHeight;
        flotOptions.events = {
            levels: keys(types).length + 1,
            data: annotations,
            types: types,
            manager: this,
        };
    };
    return EventManager;
}());
export { EventManager };
function getRegions(events) {
    return filter(events, 'isRegion');
}
function addRegionMarking(regions, flotOptions) {
    var markings = flotOptions.grid.markings;
    var defaultColor = DEFAULT_ANNOTATION_COLOR;
    var fillColor;
    each(regions, function (region) {
        if (region.source) {
            fillColor = region.color || defaultColor;
        }
        else {
            fillColor = defaultColor;
        }
        fillColor = addAlphaToRGB(fillColor, REGION_FILL_ALPHA);
        markings.push({
            xaxis: { from: region.min, to: region.timeEnd },
            color: fillColor,
        });
    });
}
function addAlphaToRGB(colorString, alpha) {
    var color = tinycolor(colorString);
    if (color.isValid()) {
        color.setAlpha(alpha);
        return color.toRgbString();
    }
    else {
        return colorString;
    }
}
//# sourceMappingURL=event_manager.js.map