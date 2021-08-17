import GraphiteQuery from './graphite_query';
import { QueryCtrl } from 'app/plugins/sdk';
import { auto } from 'angular';
import { TemplateSrv } from '@grafana/runtime';
import { actions } from './state/actions';
import { createStore, GraphiteQueryEditorState } from './state/store';
import {
  GraphiteActionDispatcher,
  GraphiteQueryEditorAngularDependencies,
  GraphiteSegment,
  GraphiteTag,
} from './types';
import { ChangeEvent } from 'react';

/**
 * @deprecated Moved to state/store
 *
 * Note: methods marked with WIP are kept for easier diffing with previous changes. They will be removed when
 * GraphiteQueryCtrl is replaced with a react component.
 */
export class GraphiteQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  declare queryModel: GraphiteQuery;
  segments: any[] = [];
  addTagSegments: any[] = [];
  declare removeTagValue: string;
  supportsTags = false;
  paused = false;

  state: GraphiteQueryEditorState;
  readonly dispatch: GraphiteActionDispatcher;

  /** @ngInject */
  constructor(
    $scope: any,
    $injector: auto.IInjectorService,
    private uiSegmentSrv: any,
    private templateSrv: TemplateSrv
  ) {
    super($scope, $injector);

    // This controller will be removed once it's root partial (query.editor.html) renders only React components.
    // All component will be wrapped in ReactQueryEditor receiving DataSourceApi in QueryRow.renderQueryEditor
    // The init() action will be removed and the store will be created in ReactQueryEditor. Note that properties
    // passed to React component in QueryRow.renderQueryEditor are different than properties passed to Angular editor
    // and will be mapped/provided in a way described below:
    const deps = {
      // WIP: to be removed. It's not passed to ReactQueryEditor but it's used only to:
      // - get refId of the query (refId be passed in query property),
      // - and to refresh changes (this will be handled by onChange passed to ReactQueryEditor)
      // - it's needed to get other targets to interpolate the query (this will be added in QueryRow)
      panelCtrl: this.panelCtrl,

      // WIP: to be replaced with query property passed to ReactQueryEditor
      target: this.target,

      // WIP: same object will be passed to ReactQueryEditor
      datasource: this.datasource,

      // This is used to create view models for Angular <metric-segment> component (view models are MetricSegment objects)
      // It will be simplified to produce data needed by React <SegmentAsync/> component
      uiSegmentSrv: this.uiSegmentSrv,

      // WIP: will be replaced with:
      // import { getTemplateSrv } from 'app/features/templating/template_srv';
      templateSrv: this.templateSrv,
    };

    const [dispatch, state] = createStore((state) => {
      this.state = state;
      // HACK: inefficient but not invoked frequently. It's needed to inform angular watcher about state changes
      // for state shared between React/AngularJS. Actions invoked from React component will not mark the scope
      // as dirty and the view won't be updated. It has to happen manually on each state change.
      this.$scope.$digest();
    });

    this.state = state;
    this.dispatch = dispatch;

    this.dispatch(actions.init(deps as GraphiteQueryEditorAngularDependencies));
  }

  parseTarget() {
    // WIP: moved to state/helpers (the same name)
  }

  async toggleEditorMode() {
    await this.dispatch(actions.toggleEditorMode());
  }

  buildSegments(modifyLastSegment = true) {
    // WIP: moved to state/helpers (the same name)
  }

  addSelectMetricSegment() {
    // WIP: moved to state/helpers (the same name)
  }

  checkOtherSegments(fromIndex: number, modifyLastSegment = true) {
    // WIP: moved to state/helpers (the same name)
  }

  setSegmentFocus(segmentIndex: any) {
    // WIP: removed
  }

  /**
   * Get list of options for an empty segment or a segment with metric when it's clicked/opened.
   *
   * This is used for new segments and segments with metrics selected.
   */
  getAltSegments(index: number, text: string): void {
    // WIP: moved to state/providers (the same name)
  }

  addAltTagSegments(prefix: string, altSegments: any[]) {
    // WIP: moved to state/providers (the same name)
  }

  removeTaggedEntry(altSegments: any[]) {
    // WIP: moved to state/providers (the same name)
  }

  /**
   * Apply changes to a given metric segment
   */
  async segmentValueChanged(segment: GraphiteSegment, index: number) {
    // WIP: moved to MetricsSegment
  }

  spliceSegments(index: any) {
    // WIP: moved to state/helpers (the same name)
  }

  emptySegments() {
    // WIP: moved to state/helpers (the same name)
  }

  async targetTextChanged(event: ChangeEvent<HTMLInputElement>) {
    // WIP: removed, handled by GraphiteTextEditor
  }

  updateModelTarget() {
    // WIP: moved to state/helpers as handleTargetChanged()
  }

  async addFunction(name: string) {
    // WIP: removed, called from AddGraphiteFunction
  }

  removeFunction(func: any) {
    // WIP: converted to "removeFunction" action  and handled in state/store reducer
    // It's now dispatched in func_editor
  }

  moveFunction(func: any, offset: any) {
    // WIP: converted to "moveFunction" action and handled in state/store reducer
    // It's now dispatched in func_editor
  }

  addSeriesByTagFunc(tag: string) {
    // WIP: moved to state/helpers (the same name)
    // It's now dispatched in func_editor
  }

  smartlyHandleNewAliasByNode(func: { def: { name: string }; params: number[]; added: boolean }) {
    // WIP: moved to state/helpers (the same name)
  }

  getAllTags() {
    // WIP: removed. It was not used.
  }

  /**
   * Get list of tags for editing exiting tag with <gf-form-dropdown>
   */
  getTags(index: number, query: string): void {
    // WIP: removed, called from TagsSection
  }

  /**
   * Get tag list when adding a new tag with <metric-segment>
   */
  getTagsAsSegments(query: string): void {
    // WIP: removed, called from TagsSection
  }

  /**
   * Get list of available tag operators
   */
  getTagOperators(): void {
    // WIP: removed, called from TagsSection
  }

  getAllTagValues(tag: { key: any }) {
    // WIP: removed. It was not used.
  }

  /**
   * Get list of available tag values
   */
  getTagValues(tag: GraphiteTag, index: number, query: string): void {
    // WIP: removed, called from TagsSection
  }

  /**
   * Apply changes when a tag is changed
   */
  async tagChanged(tag: GraphiteTag, index: number) {
    // WIP: removed, called from TagsSection
  }

  async addNewTag(segment: GraphiteSegment) {
    // WIP: removed, called from TagsSection
  }

  removeTag(index: any) {
    // WIP: removed. It was not used.
    // Tags are removed by selecting the segment called "-- remove tag --"
  }

  fixTagSegments() {
    // WIP: moved to state/helpers (the same name)
  }

  showDelimiter(index: number) {
    // WIP: removed. It was not used because of broken syntax in the template. The logic has been moved directly to the template
  }

  pause() {
    // WIP: moved to state/helpers (the same name)
  }

  async unpause() {
    // WIP: removed, called from PlayButton
  }

  getCollapsedText() {
    // WIP: removed. It was not used.
  }

  handleTagsAutoCompleteError(error: Error): void {
    // WIP: moved to state/helpers (the same name)
  }

  handleMetricsAutoCompleteError(error: Error): void {
    // WIP: moved to state/helpers (the same name)
  }
}

// WIP: moved to state/providers (the same names)
// function mapToDropdownOptions(results: any[]) {}
// function removeTagPrefix(value: string): string {}
