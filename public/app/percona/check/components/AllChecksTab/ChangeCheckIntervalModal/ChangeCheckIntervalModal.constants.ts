import { Interval } from 'app/percona/check/types';

export const checkIntervalOptions = Object.keys(Interval).map((intervalKey) => ({
  value: intervalKey,
  label: Interval[intervalKey as keyof typeof Interval],
}));
