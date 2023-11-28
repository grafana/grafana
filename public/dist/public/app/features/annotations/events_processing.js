import { concat, every, find, groupBy, head, map, partition } from 'lodash';
export function dedupAnnotations(annotations) {
    let dedup = [];
    // Split events by annotationId property existence
    const events = partition(annotations, 'id');
    const eventsById = groupBy(events[0], 'id');
    dedup = map(eventsById, (eventGroup) => {
        if (eventGroup.length > 1 && !every(eventGroup, isPanelAlert)) {
            // Get first non-panel alert
            return find(eventGroup, (event) => {
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