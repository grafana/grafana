export const DefaultRemoveFilterValue = '-- remove filter --';
export const DefaultFilterValue = 'select value';

export class FilterSegments {
  filterSegments: any[];
  removeSegment: any;

  constructor(private uiSegmentSrv, private filters, private getFilterKeysFunc, private getFilterValuesFunc) {}

  buildSegmentModel() {
    this.removeSegment = this.uiSegmentSrv.newSegment({ fake: true, value: DefaultRemoveFilterValue });

    this.filterSegments = [];
    this.filters.forEach((f, index) => {
      switch (index % 4) {
        case 0:
          this.filterSegments.push(this.uiSegmentSrv.newKey(f));
          break;
        case 1:
          this.filterSegments.push(this.uiSegmentSrv.newOperator(f));
          break;
        case 2:
          this.filterSegments.push(this.uiSegmentSrv.newKeyValue(f));
          break;
        case 3:
          this.filterSegments.push(this.uiSegmentSrv.newCondition(f));
          break;
      }
    });
    this.ensurePlusButton(this.filterSegments);
  }

  async getFilters(segment, index, hasNoFilterKeys) {
    if (segment.type === 'condition') {
      return [this.uiSegmentSrv.newSegment('AND')];
    }

    if (segment.type === 'operator') {
      return this.uiSegmentSrv.newOperators(['=', '!=', '=~', '!=~']);
    }

    if (segment.type === 'key' || segment.type === 'plus-button') {
      if (hasNoFilterKeys && segment.value && segment.value !== DefaultRemoveFilterValue) {
        this.removeSegment.value = DefaultRemoveFilterValue;
        return Promise.resolve([this.removeSegment]);
      } else {
        return this.getFilterKeysFunc(segment, DefaultRemoveFilterValue);
      }
    }

    if (segment.type === 'value') {
      const filterValues = this.getFilterValuesFunc(index);

      if (filterValues.length > 0) {
        return this.getValuesForFilterKey(filterValues);
      }
    }

    return [];
  }

  getValuesForFilterKey(labels: any[]) {
    const filterValues = labels.map(l => {
      return this.uiSegmentSrv.newSegment({
        value: `${l}`,
        expandable: false,
      });
    });

    return filterValues;
  }

  addNewFilterSegments(segment, index) {
    if (index > 2) {
      this.filterSegments.splice(index, 0, this.uiSegmentSrv.newCondition('AND'));
    }
    segment.type = 'key';
    this.filterSegments.push(this.uiSegmentSrv.newOperator('='));
    this.filterSegments.push(this.uiSegmentSrv.newFake(DefaultFilterValue, 'value', 'query-segment-value'));
  }

  removeFilterSegment(index) {
    this.filterSegments.splice(index, 3);
    // remove trailing condition
    if (index > 2 && this.filterSegments[index - 1].type === 'condition') {
      this.filterSegments.splice(index - 1, 1);
    }

    // remove condition if it is first segment
    if (index === 0 && this.filterSegments.length > 0 && this.filterSegments[0].type === 'condition') {
      this.filterSegments.splice(0, 1);
    }
  }

  ensurePlusButton(segments) {
    const count = segments.length;
    const lastSegment = segments[Math.max(count - 1, 0)];

    if (!lastSegment || lastSegment.type !== 'plus-button') {
      segments.push(this.uiSegmentSrv.newPlusButton());
    }
  }

  filterSegmentUpdated(segment, index) {
    if (segment.type === 'plus-button') {
      this.addNewFilterSegments(segment, index);
    } else if (segment.type === 'key' && segment.value === DefaultRemoveFilterValue) {
      this.removeFilterSegment(index);
      this.ensurePlusButton(this.filterSegments);
    } else if (segment.type === 'value' && segment.value !== DefaultFilterValue) {
      this.ensurePlusButton(this.filterSegments);
    }

    return this.filterSegments.filter(s => s.type !== 'plus-button').map(seg => seg.value);
  }
}
