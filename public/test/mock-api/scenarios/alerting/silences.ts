import { silencesListHandler } from 'app/features/alerting/unified/mocks/server/handlers/silences';

export const SILENCES_SCENARIOS = {
  noSilences: [silencesListHandler([])],
};
