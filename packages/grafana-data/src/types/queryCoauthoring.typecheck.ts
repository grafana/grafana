import type { DataQuery, DataSourceApi, DataSourceJsonData, DataSourceOptionsType } from '../index';
import type {
  DataSourceWithQueryCoauthoring,
  QueryCoauthoringApplyResult,
  QueryCoauthoringChange,
  QueryCoauthoringClosedReason,
  QueryCoauthoringDiff,
  QueryCoauthoringHealth,
  QueryCoauthoringLanguage,
  QueryCoauthoringPrepareResult,
  QueryCoauthoringPreviewOutcome,
  QueryCoauthoringRange,
  QueryCoauthoringSession,
  QueryCoauthoringStagedOption,
  QueryCoauthoringStageResult,
  QueryCoauthoringState,
  QueryCoauthoringTextChange,
} from '../unstable';

interface CustomQuery extends DataQuery {
  expr: string;
}

interface CustomOptions extends DataSourceJsonData {
  mandatorySetting: string;
}

type Assert<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

type CustomDataSource = DataSourceApi<CustomQuery, CustomOptions> & {
  queryCoauthoring(): QueryCoauthoringLanguage<CustomQuery>;
};

export type CustomOptionsAreAccepted = Assert<
  CustomDataSource extends DataSourceWithQueryCoauthoring<CustomQuery, CustomOptions> ? true : false
>;
export type OptionsArePreserved = Assert<
  Equal<DataSourceOptionsType<DataSourceWithQueryCoauthoring<CustomQuery, CustomOptions>>, CustomOptions>
>;
export type QueryIsPreserved = Assert<
  Equal<
    Parameters<
      ReturnType<NonNullable<DataSourceWithQueryCoauthoring<CustomQuery, CustomOptions>['queryCoauthoring']>>['prepare']
    >[0],
    CustomQuery
  >
>;
export type DefaultOptionsRemainCompatible = Assert<
  DataSourceApi extends DataSourceWithQueryCoauthoring ? true : false
>;
export type StableDatasourceHasNoCoauthoring = Assert<
  Equal<'queryCoauthoring' extends keyof DataSourceApi ? true : false, false>
>;
export type RangeIsPublic = Assert<Equal<QueryCoauthoringTextChange['originalRanges'][number], QueryCoauthoringRange>>;
export type HealthIsPublic = Assert<Equal<QueryCoauthoringState['health'][string], QueryCoauthoringHealth>>;
export type PreviewOutcomeIsPublic = Assert<
  Equal<QueryCoauthoringStagedOption['previewOutcome'], QueryCoauthoringPreviewOutcome | null>
>;
export type ChangeIsPublic = Assert<
  Equal<Parameters<QueryCoauthoringSession['stageProposal']>[0][number]['changes'][number], QueryCoauthoringChange>
>;
export type DiffIsPublic = Assert<Equal<QueryCoauthoringStagedOption['diffs'][number], QueryCoauthoringDiff>>;
export type StagedOptionIsPublic = Assert<
  Equal<QueryCoauthoringState['proposal'], QueryCoauthoringStagedOption[] | null>
>;
export type StageResultIsPublic = Assert<
  Equal<Awaited<ReturnType<QueryCoauthoringSession['stageProposal']>>, QueryCoauthoringStageResult[]>
>;
export type ApplyResultIsPublic = Assert<
  Equal<Awaited<ReturnType<QueryCoauthoringSession['accept']>>, QueryCoauthoringApplyResult>
>;
export type ClosedReasonIsPublic = Assert<
  Equal<Awaited<QueryCoauthoringSession['closed']>, QueryCoauthoringClosedReason>
>;
export type TextChangeIsPublic = Assert<
  Equal<Extract<QueryCoauthoringPrepareResult, { status: 'ready' }>['changes'][number], QueryCoauthoringTextChange>
>;
