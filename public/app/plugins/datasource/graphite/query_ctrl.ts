import './add_graphite_func';
import './func_editor';

import GraphiteQuery from './graphite_query';
import { QueryCtrl } from 'app/plugins/sdk';
import { auto } from 'angular';
import { TemplateSrv } from '@grafana/runtime';
import { actions } from './actions';
import { getAltSegments, getTagOperators, getTags, getTagsAsSegments, getTagValues } from './providers';
import { createStore, GraphiteQueryEditorState } from './state';
import {
  AngularDropdownOptions,
  GraphiteActionDispatcher,
  GraphiteQueryEditorAngularDependencies,
  GraphiteSegment,
  GraphiteTag,
} from './types';

/**
 * @deprecated Moving to React/Flux in progress.
 *
 * State of this controller has been encapsulated in a single "state" object and all methods have been converted
 * to pure function that modify this state.
 *
 * Methods that have not been moved to controller but removed:
 * - targetTextChanged()
 *   targetChanged is used instead - it avoid double requests and checks for errors
 * - getAllTags()
 *   not used
 * - getAllTagValues()
 *   not used
 * - removeTag()
 *   not used (tags are removed by selecting the segment -- remove tag --)
 * - getCollapsedText()
 *   not used
 * - showDelimiter()
 *   it was not used because of broken syntax in the template. moved directly to the template
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

  /**
   * Get list of options for an empty segment or a segment with metric when it's clicked/opened.
   *
   * This is used for new segments and segments with metrics selected.
   */
  async getAltSegments(index: number, text: string): Promise<GraphiteSegment[]> {
    return await getAltSegments(this.state, index, text);
  }

  /**
   * Apply changes to a given metric segment
   */
  async segmentValueChanged(segment: GraphiteSegment, index: number) {
    await this.dispatch(actions.segmentValueChanged(segment, index));
  }

  /**
   * Get list of tags for a tag segment
   */
  async getTags(index: number, query: string): Promise<AngularDropdownOptions[]> {
    return await getTags(this.state, index, query);
  }

  /**
   * Apply changes when a tag is changed
   */
  async tagChanged(tag: GraphiteTag, index: number) {
    await this.dispatch(actions.tagChanged(tag, index));
  }

  /**
   * Get list of available tag values
   */
  async getTagValues(tag: GraphiteTag, index: number, query: string): Promise<AngularDropdownOptions[]> {
    return await getTagValues(this.state, tag, index, query);
  }

  /**
   * Get list of available tag operators
   */
  getTagOperators(): AngularDropdownOptions[] {
    return getTagOperators();
  }

  /**
   * Get tag list when a new tag is added
   */
  async getTagsAsSegments(query: string): Promise<GraphiteSegment[]> {
    return await getTagsAsSegments(this.state, query);
  }

  async addNewTag(segment: GraphiteSegment) {
    await this.dispatch(actions.addNewTag(segment));
  }

  async unpause() {
    await this.dispatch(actions.unpause());
  }

  async addFunction(name: string) {
    await this.dispatch(actions.addFunction(name));
  }

  async targetChanged() {
    await this.dispatch(actions.targetChanged());
  }

  async toggleEditorMode() {
    await this.dispatch(actions.toggleEditorMode());
  }
}
