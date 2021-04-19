import './add_graphite_func';
import './func_editor';

import GraphiteQuery from './graphite_query';
import { QueryCtrl } from 'app/plugins/sdk';
import { auto } from 'angular';
import { TemplateSrv } from '@grafana/runtime';
import { actions } from './actions';
import { create, GraphiteQueryEditorState } from './state';
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
  segments: any[];
  addTagSegments: any[];
  removeTagValue: string;
  supportsTags: boolean;
  paused: boolean;

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

    const [dispatch, state] = create(this, (state) => {
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

  async dispatchAndHandleGetAltSegments(index: number, text: string) {
    await this.dispatch(actions.getAltSegments(index, text));
    return this.state.altSegments;
  }

  async dispatchSegmentValueChanged(segment: GraphiteSegment, index: number) {
    this.dispatch(actions.segmentValueChanged(segment, index));
  }

  async dispatchAndHandleGetTags(index: number, query: string): Promise<AngularDropdownOptions[]> {
    await this.dispatch(actions.getTags(index, query));
    return this.state.allTags;
  }

  dispatchTagChanged(tag: GraphiteTag, index: number) {
    this.dispatch(actions.tagChanged(tag, index));
  }

  async dispatchAndHandleGetTagValues(tag: GraphiteTag, index: number, query: string) {
    await this.dispatch(actions.getTagValues(tag, index, query));
    return this.state.tagValues;
  }

  async dispatchAndHandleGetTagOperators() {
    await this.dispatch(actions.getTagOperators());
    return this.state.tagOperators;
  }

  async dispatchAndHandleGetTagsAsSegments(query: string) {
    await this.dispatch(actions.getTagsAsSegments(query));
    return this.state.tagsAsSegments;
  }

  dispatchAddNewTag(segment: GraphiteSegment) {
    this.dispatch(actions.addNewTag(segment));
  }

  dispatchUnpause() {
    this.dispatch(actions.unpause());
  }

  dispatchAddFunction(name: string) {
    this.dispatch(actions.addFunction(name));
  }

  dispatchTargetChanged() {
    this.dispatch(actions.targetChanged());
  }

  toggleEditorMode() {
    this.dispatch(actions.toggleEditorMode());
  }
}
