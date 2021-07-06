import './add_graphite_func';
import './func_editor';

import GraphiteQuery from './graphite_query';
import { QueryCtrl } from 'app/plugins/sdk';
import { auto } from 'angular';
import { TemplateSrv } from '@grafana/runtime';
import { actions } from './state/actions';
import { getAltSegments, getTagOperators, getTags, getTagsAsSegments, getTagValues } from './state/providers';
import { createStore, GraphiteQueryEditorState } from './state/state';
import {
  AngularDropdownOptions,
  GraphiteActionDispatcher,
  GraphiteQueryEditorAngularDependencies,
  GraphiteSegment,
  GraphiteTag,
} from './types';

/**
 * @deprecated Moving to React/Flux in progress.
 */
export class GraphiteQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  queryModel: GraphiteQuery;
  segments: any[] = [];
  addTagSegments: any[] = [];
  removeTagValue: string;
  supportsTags = false;
  paused = false;

  private state: GraphiteQueryEditorState;
  private readonly dispatch: GraphiteActionDispatcher;

  /** @ngInject */
  constructor(
    $scope: any,
    $injector: auto.IInjectorService,
    private uiSegmentSrv: any,
    private templateSrv: TemplateSrv
  ) {
    super($scope, $injector);

    // TODO: dependencies passed by Angular. It will be removed when editor is moved to React.
    // The React component will receive different properties - see QueryRow.renderQueryEditor
    const deps = {
      // TODO:  Not passed to ReactQueryEditor. Will onChange take care of it?
      panelCtrl: this.panelCtrl,
      // TODO: Passed to ReactQueryEditor as "query".
      target: this.target,
      // TODO: Passed to ReactQueryEditor.
      datasource: this.datasource,
      // TODO:  Not passed to ReactQueryEditor. Will onChange take care of it?
      panel: this.panel,
      // TODO: Not passed to ReactQueryEditor. Is it needed?
      isLastQuery: this.isLastQuery,
      // TODO: Not passed to ReactQueryEditor. Should be converted to a singleton.
      uiSegmentSrv: this.uiSegmentSrv,
      // TODO: Not passed to ReactQueryEditor, but available as as singleton.
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
    // WIP: moved to state/helpers (the same name)
  }

  /**
   * Get list of options for an empty segment or a segment with metric when it's clicked/opened.
   *
   * This is used for new segments and segments with metrics selected.
   */
  async getAltSegments(index: number, text: string): Promise<GraphiteSegment[]> {
    return await getAltSegments(this.state, index, text);
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
    await this.dispatch(actions.segmentValueChanged({ segment, index }));
  }

  spliceSegments(index: any) {
    // WIP: moved to state/helpers (the same name)
  }

  emptySegments() {
    // WIP: moved to state/helpers (the same name)
  }

  targetTextChanged() {
    // WIP: targetChanged() is used instead - it avoid double requests and checks for errors
  }

  updateModelTarget() {
    // WIP: removed. It was used in two places:
    // - handleTargetChanged() -> the logic was moved directly there
    // - targetTextChanged() -> this method was removed
  }

  async targetChanged() {
    await this.dispatch(actions.targetChanged());
  }

  async addFunction(name: string) {
    await this.dispatch(actions.addFunction({ name }));
  }

  removeFunction(func: any) {
    // WIP: converted to "removeFunction" action  and handled in state/state.ts reducer
    // It's now dispatched in func_editor
  }

  moveFunction(func: any, offset: any) {
    // WIP: converted to "moveFunction" action and handled in state/state.ts reducer
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
   * Get list of tags for a tag segment
   */
  async getTags(index: number, query: string): Promise<AngularDropdownOptions[]> {
    return await getTags(this.state, index, query);
  }

  /**
   * Get tag list when a new tag is added
   */
  async getTagsAsSegments(query: string): Promise<GraphiteSegment[]> {
    return await getTagsAsSegments(this.state, query);
  }

  /**
   * Get list of available tag operators
   */
  getTagOperators(): AngularDropdownOptions[] {
    return getTagOperators();
  }

  getAllTagValues(tag: { key: any }) {
    // WIP: removed. It was not used.
  }

  /**
   * Get list of available tag values
   */
  async getTagValues(tag: GraphiteTag, index: number, query: string): Promise<AngularDropdownOptions[]> {
    return await getTagValues(this.state, tag, index, query);
  }

  /**
   * Apply changes when a tag is changed
   */
  async tagChanged(tag: GraphiteTag, index: number) {
    await this.dispatch(actions.tagChanged({ tag, index }));
  }

  async addNewTag(segment: GraphiteSegment) {
    await this.dispatch(actions.addNewTag({ segment }));
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
    await this.dispatch(actions.unpause());
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
