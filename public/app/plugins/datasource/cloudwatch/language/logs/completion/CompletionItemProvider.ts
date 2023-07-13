import { getTemplateSrv, type TemplateSrv } from '@grafana/runtime';

import { type ResourcesAPI } from '../../../resources/ResourcesAPI';
import { CompletionItemProvider } from '../../monarch/CompletionItemProvider';

import { getStatementPosition } from './statementPosition';
import { LogsTokenTypes } from './types';

export class LogsCompletionItemProvider extends CompletionItemProvider {
  constructor(resources: ResourcesAPI, templateSrv: TemplateSrv = getTemplateSrv()) {
    super(resources, templateSrv);
    this.getStatementPosition = getStatementPosition;
    this.tokenTypes = LogsTokenTypes;
  }
}
