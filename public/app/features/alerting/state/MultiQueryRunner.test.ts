import { MultiQueryRunner } from './MultiQueryRunner';
import { DataFrame, dateMath, dateTime, DateTime, LoadingState, PanelData, RawTimeRange } from '@grafana/data';
import { Observable, Subject } from 'rxjs';
import { GetDataOptions, QueryRunnerOptions } from '../../query/state/PanelQueryRunner';
import { first } from 'rxjs/operators';

jest.mock('../../query/state/PanelQueryRunner', () => {
  return {
    run: jest.fn(),
    getData: jest.fn(),
  };
});

const fakePanelDataA = {
  series: [] as DataFrame[],
  state: LoadingState.Done,
  timeRange: {
    from: dateMath.parse('now-6h')!,
    to: dateMath.parse('now-3h')!,
    raw: { from: 'now-6h', to: 'now-3h' },
  },
};

const fakePanelDataB = {
  series: [] as DataFrame[],
  state: LoadingState.Done,
  timeRange: { from: dateMath.parse('now-3h')!, to: dateMath.parse('now')!, raw: { from: 'now-3h', to: 'now' } },
};

const expectedResult: PanelData[] = [fakePanelDataA, fakePanelDataB];

describe('Multi query runner', () => {
  it('should do stuff', async () => {
    const fakeA = new FakePanelQueryRunner(fakePanelDataA);
    const fakeB = new FakePanelQueryRunner(fakePanelDataB);
    const createRunner = jest.fn();
    createRunner.mockReturnValueOnce(fakeA);
    createRunner.mockReturnValueOnce(fakeB);
    const multiRunner = new MultiQueryRunner(createRunner);

    await multiRunner.run({
      dataSource: { name: 'test' },
      queries: [
        {
          refId: 'A',
          timeRange: {
            from: dateMath.parse('now-6h')!,
            to: dateMath.parse('now-3h')!,
            raw: { from: 'now-6h', to: 'now-3h' },
          },
        },
        {
          refId: 'B',
          timeRange: {
            from: dateMath.parse('now-3h')!,
            to: dateMath.parse('now')!,
            raw: { from: 'now-3h', to: 'now' },
          },
        },
      ],
    });

    await expect(multiRunner.getData()).toEmitValuesWith((value) => {
      expect(value[0]).toBe(expectedResult);
    });
  });
});

class FakePanelQueryRunner {
  private data: PanelData;
  private subject: Subject<PanelData>;
  constructor(data: PanelData) {
    this.data = data;
    this.subject = new Subject();
  }
  setNextPanelData(data: PanelData) {
    this.data = data;
  }
  async run(options: QueryRunnerOptions) {
    this.subject.next(this.data);
  }
  getData(options: GetDataOptions): Observable<PanelData> {
    return this.subject.asObservable();
  }
}
