import { map } from 'rxjs';
import { DataTransformerID, getFrameDisplayName, ValueMatcherID, } from '@grafana/data';
import { FilterByValueMatch, FilterByValueType } from '@grafana/data/src/transformations/transformers/filterByValue';
export function getTableFilterTransform(query) {
    const regex = {
        id: ValueMatcherID.regex,
        options: { value: query },
    };
    return {
        id: DataTransformerID.filterByValue,
        options: {
            type: FilterByValueType.include,
            match: FilterByValueMatch.all,
            filters: [
                {
                    fieldName: 'handler',
                    config: regex,
                },
            ],
        },
    };
}
export function getTimeSeriesFilterTransform(query) {
    return () => (source) => {
        return source.pipe(map((data) => {
            return data.filter((frame) => getFrameDisplayName(frame).toLowerCase().includes(query.toLowerCase()));
        }));
    };
}
//# sourceMappingURL=transforms.js.map