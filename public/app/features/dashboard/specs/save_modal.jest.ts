import { SaveDashboardModalCtrl } from '../save_modal';

jest.mock('app/core/services/context_srv', () => ({}));

describe('SaveDashboardModal', () => {
  describe('save modal checkboxes', () => {
    it('should hide checkboxes', () => {
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

      expect(modal.compareTime()).toBe(false);
      expect(modal.compareTemplating()).toBe(true);
    });

    it('should show checkboxes', () => {
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
      expect(modal.compareTime()).toBe(true);
      expect(modal.compareTemplating()).toBe(false);
    });
  });
});
