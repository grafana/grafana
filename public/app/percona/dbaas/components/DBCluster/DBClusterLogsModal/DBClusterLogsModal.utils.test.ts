import { DBClusterLogs } from '../DBCluster.types';
import { dbClusterLogsAPI } from '../__mocks__/dbClustersStubs';

import { logsToString, toggleLogs, transformLogs } from './DBClusterLogsModal.utils';

describe('DBClusterLogsModal.utils::', () => {
  describe('transformLogs::', () => {
    it('transforms logs to expected format', () => {
      const expectedLogs: DBClusterLogs = {
        pods: [
          {
            name: 'testpod1',
            isOpen: false,
            events: 'test pod1\nevents',
            containers: [
              {
                name: 'testpod1container1',
                isOpen: false,
                logs: 'test pod1\nlogs\n1',
              },
              {
                name: 'testpod1container2',
                isOpen: false,
                logs: 'test pod1\nlogs\n2',
              },
            ],
          },
          {
            name: 'testpod2',
            isOpen: false,
            events: 'test pod2\nevents',
            containers: [
              {
                name: 'testpod2container1',
                isOpen: false,
                logs: 'test pod2\nlogs\n1',
              },
              {
                name: 'testpod2container2',
                isOpen: false,
                logs: '',
              },
            ],
          },
        ],
      };

      expect(transformLogs(dbClusterLogsAPI)).toEqual(expectedLogs);
    });
  });
  describe('logsToString::', () => {
    it('parses array of logs to string', () => {
      const logs = ['list', 'was', 'updated'];

      expect(logsToString(logs)).toEqual('list\nwas\nupdated');
    });
    it('handles empty logs', () => {
      expect(logsToString([])).toEqual('');
    });
    it('handles undefined logs', () => {
      expect(logsToString(undefined)).toEqual('');
    });
  });
  describe('toggleLogs::', () => {
    const logs = {
      pods: [
        {
          name: 'testpod1',
          isOpen: true,
          events: 'test pod1\nevents',
          containers: [
            {
              name: 'testpod1container1',
              isOpen: false,
              logs: 'test pod1\nlogs\n1',
            },
            {
              name: 'testpod1container2',
              isOpen: false,
              logs: 'test pod1\nlogs\n2',
            },
          ],
        },
      ],
    };
    it('expands all the logs', () => {
      const expectedLogs = [
        {
          name: 'testpod1',
          isOpen: true,
          events: 'test pod1\nevents',
          containers: [
            {
              name: 'testpod1container1',
              isOpen: true,
              logs: 'test pod1\nlogs\n1',
            },
            {
              name: 'testpod1container2',
              isOpen: true,
              logs: 'test pod1\nlogs\n2',
            },
          ],
        },
      ];

      expect(toggleLogs(logs.pods, true)).toEqual(expectedLogs);
    });
    it('collapses all the logs', () => {
      const expectedLogs = [
        {
          name: 'testpod1',
          isOpen: false,
          events: 'test pod1\nevents',
          containers: [
            {
              name: 'testpod1container1',
              isOpen: false,
              logs: 'test pod1\nlogs\n1',
            },
            {
              name: 'testpod1container2',
              isOpen: false,
              logs: 'test pod1\nlogs\n2',
            },
          ],
        },
      ];

      expect(toggleLogs(logs.pods, false)).toEqual(expectedLogs);
    });
  });
});
