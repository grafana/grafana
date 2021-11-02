import { concat, every, find, groupBy, head, map, partition } from 'lodash';
export function dedupAnnotations(annotations) {
    var dedup = [];
    // Split events by annotationId property existence
    var events = partition(annotations, 'id');
    var eventsById = groupBy(events[0], 'id');
    dedup = map(eventsById, function (eventGroup) {
        if (eventGroup.length > 1 && !every(eventGroup, isPanelAlert)) {
            // Get first non-panel alert
            return find(eventGroup, function (event) {
                return event.eventType !== 'panel-alert';
            });
        }
        else {
            return head(eventGroup);
        }
    });
    dedup = concat(dedup, events[1]);
    return dedup;
}
function isPanelAlert(event) {
    return event.eventType === 'panel-alert';
}
//# sourceMappingURL=events_processing.js.map