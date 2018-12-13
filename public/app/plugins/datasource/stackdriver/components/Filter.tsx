import React from 'react';
import _ from 'lodash';

import Segment from './Segment';
import { QueryMeta, Target } from '../types';
import { FilterSegments } from '../filter_segments';

export interface Props {
  onChange: (metricDescriptor) => void;
  templateSrv: any;
  labelData: QueryMeta;
  loading: Promise<any>;
  target: Target;
  uiSegmentSrv: any;
}

interface State {
  defaultRemoveGroupByValue: string;
  resourceTypeValue: string;
  groupBySegments: any[];
  // filterSegments: FilterSegments;
  filterSegments: any;
  removeSegment?: any;
}

export class Filter extends React.Component<Props, State> {
  state: State = {
    defaultRemoveGroupByValue: '-- remove group by --',
    resourceTypeValue: 'resource.type',
    groupBySegments: [],
    filterSegments: new FilterSegments(this.getFilterKeys.bind(this), this.getFilterValues.bind(this)),
  };

  constructor(props) {
    super(props);
  }

  componentDidMount() {
    this.initSegments(false);
  }

  shouldComponentUpdate(nextProps) {
    return this.state.filterSegments.filterSegments.length > 0;
  }

  initSegments(hideGroupBys: boolean) {
    this.state.filterSegments.init(this.props.uiSegmentSrv);
    if (!hideGroupBys) {
      this.setState({
        groupBySegments: this.props.target.aggregation.groupBys.map(groupBy => {
          return this.props.uiSegmentSrv.getSegmentForValue(groupBy);
        }),
      });

      this.ensurePlusButton(this.state.groupBySegments);
    }

    this.setState({
      removeSegment: this.props.uiSegmentSrv.newSegment({ fake: true, value: '-- remove group by --' }),
    });

    this.state.filterSegments.buildSegmentModel(this.props.target.filters);
  }

  async createLabelKeyElements() {
    await this.props.loading;

    let elements = Object.keys(this.props.labelData.metricLabels || {}).map(l => {
      return this.props.uiSegmentSrv.newSegment({
        value: `metric.label.${l}`,
        expandable: false,
      });
    });

    elements = [
      ...elements,
      ...Object.keys(this.props.labelData.resourceLabels || {}).map(l => {
        return this.props.uiSegmentSrv.newSegment({
          value: `resource.label.${l}`,
          expandable: false,
        });
      }),
    ];

    if (this.props.labelData.resourceTypes && this.props.labelData.resourceTypes.length > 0) {
      elements = [
        ...elements,
        this.props.uiSegmentSrv.newSegment({
          value: this.state.resourceTypeValue,
          expandable: false,
        }),
      ];
    }

    return elements;
  }

  async getFilterKeys(segment, removeText?: string) {
    let elements = await this.createLabelKeyElements();

    if (this.props.target.filters.indexOf(this.state.resourceTypeValue) !== -1) {
      elements = elements.filter(e => e.value !== this.state.resourceTypeValue);
    }

    const noValueOrPlusButton = !segment || segment.type === 'plus-button';
    if (noValueOrPlusButton && elements.length === 0) {
      return [];
    }

    return [
      ...elements,
      this.props.uiSegmentSrv.newSegment({ fake: true, value: removeText || this.state.defaultRemoveGroupByValue }),
    ];
  }

  async getGroupBys(segment) {
    let elements = await this.createLabelKeyElements();

    elements = elements.filter(e => this.props.target.aggregation.groupBys.indexOf(e.value) === -1);
    const noValueOrPlusButton = !segment || segment.type === 'plus-button';
    if (noValueOrPlusButton && elements.length === 0) {
      return [];
    }

    this.state.removeSegment.value = this.state.defaultRemoveGroupByValue;
    return [...elements, this.state.removeSegment];
  }

  groupByChanged(segment, index) {
    if (segment.value === this.state.removeSegment.value) {
      // this.groupBySegments.splice(index, 1);
    } else {
      segment.type = 'value';
    }

    const reducer = (memo, seg) => {
      if (!seg.fake) {
        memo.push(seg.value);
      }
      return memo;
    };

    this.props.target.aggregation.groupBys = this.state.groupBySegments.reduce(reducer, []);
    this.ensurePlusButton(this.state.groupBySegments);
    // this.$rootScope.$broadcast('metricTypeChanged');
    // this.$scope.refresh();
  }

  async getFilters(segment, index) {
    await this.props.loading;
    const hasNoFilterKeys =
      this.props.labelData.metricLabels && Object.keys(this.props.labelData.metricLabels).length === 0;
    return this.state.filterSegments.getFilters(segment, index, hasNoFilterKeys);
  }

  getFilterValues(index) {
    const filterKey = this.props.templateSrv.replace(this.state.filterSegments.filterSegments[index - 2].value);
    if (
      !filterKey ||
      !this.props.labelData.metricLabels ||
      Object.keys(this.props.labelData.metricLabels).length === 0
    ) {
      return [];
    }

    const shortKey = filterKey.substring(filterKey.indexOf('.label.') + 7);

    if (filterKey.startsWith('metric.label.') && this.props.labelData.metricLabels.hasOwnProperty(shortKey)) {
      return this.props.labelData.metricLabels[shortKey];
    }

    if (filterKey.startsWith('resource.label.') && this.props.labelData.resourceLabels.hasOwnProperty(shortKey)) {
      return this.props.labelData.resourceLabels[shortKey];
    }

    if (filterKey === this.state.resourceTypeValue) {
      return this.props.labelData.resourceTypes;
    }

    return [];
  }

  filterSegmentUpdated(segment, index) {
    this.props.target.filters = this.state.filterSegments.filterSegmentUpdated(segment, index);
    // this.$scope.refresh();
  }

  ensurePlusButton(segments) {
    const count = segments.length;
    const lastSegment = segments[Math.max(count - 1, 0)];

    if (!lastSegment || lastSegment.type !== 'plus-button') {
      segments.push(this.props.uiSegmentSrv.newPlusButton());
    }
  }

  render() {
    const { filterSegments } = this.state;
    // const { metrifilterSegmentscType } = this.props;

    return (
      <React.Fragment>
        <div className="gf-form-inline">
          <div className="gf-form">
            <span className="gf-form-label query-keyword width-9">Filter</span>
            <div className="gf-form">
              {filterSegments.filterSegments.map((segment, i) => (
                <Segment
                  key={i}
                  segment={segment}
                  getOptions={() => this.getFilters(segment, i)}
                  onChange={segment => this.filterSegmentUpdated(segment, i)}
                />
              ))}
            </div>
          </div>
          <div className="gf-form gf-form--grow">
            <div className="gf-form-label gf-form-label--grow" />
          </div>
        </div>
        {/* <div className="gf-form-inline" ng-hide="ctrl.$scope.hideGroupBys">
          <div className="gf-form">
            <span className="gf-form-label query-keyword width-9">Group By</span>
            <div className="gf-form" ng-repeat="segment in ctrl.groupBySegments">
              <Segment
                segment="segment"
                get-options="ctrl.getGroupBys(segment)"
                on-change="ctrl.groupByChanged(segment, $index)"
              />
            </div>
          </div>
          <div className="gf-form gf-form--grow">
            <div className="gf-form-label gf-form-label--grow" />
          </div>
        </div> */}
      </React.Fragment>
    );
  }
}
