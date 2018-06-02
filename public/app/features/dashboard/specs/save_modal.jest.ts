import { SaveDashboardModalCtrl } from '../save_modal';

jest.mock('app/core/services/context_srv', () => ({}));

describe('SaveDashboardModal', () => {
  describe('save modal checkboxes', () => {
    it('should show checkboxes', () => {
      let fakeDashboardSrv = {
        dash: {
          templating: {
            list: [
              {
                current: {
                  selected: true,
                  tags: Array(0),
                  text: 'server_001',
                  value: 'server_001',
                },
                name: 'Server',
              },
            ],
          },
          originalTemplating: [
            {
              current: {
                selected: true,
                text: 'server_002',
                value: 'server_002',
              },
              name: 'Server',
            },
          ],
          time: {
            from: 'now-3h',
            to: 'now',
          },
          originalTime: {
            from: 'now-6h',
            to: 'now',
          },
        },
      };
      let modal = new SaveDashboardModalCtrl(fakeDashboardSrv);

      expect(modal.timeChange).toBe(true);
      expect(modal.variableChange).toBe(true);
    });

    it('should hide checkboxes', () => {
      let fakeDashboardSrv = {
        dash: {
          templating: {
            list: [
              {
                current: {
                  selected: true,
                  //tags: Array(0),
                  text: 'server_002',
                  value: 'server_002',
                },
                name: 'Server',
              },
            ],
          },
          originalTemplating: [
            {
              current: {
                selected: true,
                text: 'server_002',
                value: 'server_002',
              },
              name: 'Server',
            },
          ],
          time: {
            from: 'now-3h',
            to: 'now',
          },
          originalTime: {
            from: 'now-3h',
            to: 'now',
          },
        },
      };
      let modal = new SaveDashboardModalCtrl(fakeDashboardSrv);
      expect(modal.timeChange).toBe(false);
      expect(modal.variableChange).toBe(false);
    });
  });
});
