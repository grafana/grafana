import GraphiteQuery from './graphite_query';
import { QueryCtrl } from 'app/plugins/sdk';
import { auto } from 'angular';
import { TemplateSrv } from '@grafana/runtime';
import { actions } from './state/actions';
import { createStore, GraphiteQueryEditorState } from './state/store';
import { GraphiteActionDispatcher, GraphiteQueryEditorAngularDependencies } from './types';

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

  async toggleEditorMode() {
    await this.dispatch(actions.toggleEditorMode());
  }
}
