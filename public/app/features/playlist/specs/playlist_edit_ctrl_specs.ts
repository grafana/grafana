import '../playlist_edit_ctrl';
import {describe, beforeEach, it, expect} from 'test/lib/common';
import {PlaylistEditCtrl} from '../playlist_edit_ctrl';

describe.only('PlaylistEditCtrl', function() {
  var ctx: any;
  beforeEach(() => {
    ctx = new PlaylistEditCtrl(null, null, null, null, { current: { params: {} } });

    ctx.dashboardresult = [
      { id: 2, title: 'dashboard: 2' },
      { id: 3, title: 'dashboard: 3' }
    ];

    ctx.tagresult = [
      { term: 'graphie', count: 1 },
      { term: 'nyc', count: 2 }
    ];
  });

  describe('searchresult returns 2 dashboards', function() {
    it('found dashboard should be 2', function() {
      expect(ctx.dashboardresult.length).to.be(2);
    });

    it('filtred dashboard should be 2', function() {
      ctx.filterFoundPlaylistItems();
      expect(ctx.filteredDashboards.length).to.be(2);
    });

    describe('adds one dashboard to playlist', () => {
      beforeEach(() => {
        ctx.addPlaylistItem({ id: 2, title: 'dashboard: 2' });
        ctx.filterFoundPlaylistItems();
      });

      it('playlistitems should be increased by one', () => {
        expect(ctx.playlistItems.length).to.be(1);
      });

      it('filtred playlistitems should be reduced by one', () => {
        expect(ctx.filteredDashboards.length).to.be(1);
      });

      it('found dashboard should be 2', function() {
        expect(ctx.dashboardresult.length).to.be(2);
      });

      describe('removes one dashboard from playlist', () => {
        beforeEach(() => {
          ctx.removePlaylistItem(ctx.playlistItems[0]);
          ctx.filterFoundPlaylistItems();
        });

        it('playlistitems should be increased by one', () => {
          expect(ctx.playlistItems.length).to.be(0);
        });

        it('found dashboard should be 2', function() {
          expect(ctx.dashboardresult.length).to.be(2);
        });

        it('filtred playlist should be reduced by one', () => {
          expect(ctx.filteredDashboards.length).to.be(2);
        });
      });
    });
  });
});
