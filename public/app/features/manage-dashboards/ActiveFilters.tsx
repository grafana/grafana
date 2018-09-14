import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { DashboardQuery } from 'app/types';
import { removeStarredFilter, removeTag, clearFilters } from './state/actions';
import { getDashboardQuery } from './state/selectors';

export interface Props {
  query: DashboardQuery;
  removeStarredFilter: typeof removeStarredFilter;
  removeTag: typeof removeTag;
  clearFilters: typeof clearFilters;
}

export class ActiveFilters extends PureComponent<Props, any> {
  removeTag = tagName => {
    this.props.removeTag(tagName);
  };

  removeStarred = () => {
    this.props.removeStarredFilter();
  };

  clearFilters = () => {
    this.props.clearFilters();
  };

  render() {
    const { query } = this.props;

    return (
      <div className="page-action-bar page-action-bar--narrow">
        <div className="gf-form-inline">
          {query.tag.length > 0 && (
            <div className="gf-form">
              <label className="gf-form-label width-4">Tags</label>
              <div className="gf-form-input gf-form-input--plaintext">
                {query.tag.map((tagName, index) => {
                  return (
                    <span key={`${tagName}-${index}`}>
                      <div
                        onClick={() => {
                          this.removeTag(tagName);
                        }}
                        tag-color-from-name="tagName"
                        className="tag label label-tag"
                      >
                        <i className="fa fa-remove" />&nbsp;{tagName}
                      </div>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          {query.starred && (
            <div className="gf-form">
              <label className="gf-form-label">
                <div className="pointer" onClick={this.removeStarred}>
                  <i className="fa fa-fw fa-check" /> Starred
                </div>
              </label>
            </div>
          )}

          <div className="gf-form">
            <label className="gf-form-label">
              <div
                className="pointer"
                onClick={this.clearFilters}
                bs-tooltip="'Clear current search query and filters'"
              >
                <i className="fa fa-remove" />&nbsp;Clear
              </div>
            </label>
          </div>
        </div>
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    query: getDashboardQuery(state.manageDashboards),
  };
}

const mapDispatchToProps = {
  removeStarredFilter,
  removeTag,
  clearFilters,
};

export default connect(mapStateToProps, mapDispatchToProps)(ActiveFilters);
