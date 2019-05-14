import '../playlist_edit_ctrl';
import { PlaylistEditCtrl } from '../playlist_edit_ctrl';
describe('PlaylistEditCtrl', function () {
    var ctx;
    beforeEach(function () {
        var navModelSrv = {
            getNav: function () {
                return { breadcrumbs: [], node: {} };
            },
        };
        ctx = new PlaylistEditCtrl(null, null, null, { current: { params: {} } }, navModelSrv);
        ctx.dashboardresult = [{ id: 2, title: 'dashboard: 2' }, { id: 3, title: 'dashboard: 3' }];
        ctx.tagresult = [{ term: 'graphite', count: 1 }, { term: 'nyc', count: 2 }];
    });
    describe('searchresult returns 2 dashboards, ', function () {
        it('found dashboard should be 2', function () {
            expect(ctx.dashboardresult.length).toBe(2);
        });
        it('filtred result should be 2', function () {
            ctx.filterFoundPlaylistItems();
            expect(ctx.filteredDashboards.length).toBe(2);
            expect(ctx.filteredTags.length).toBe(2);
        });
        describe('adds one dashboard to playlist, ', function () {
            beforeEach(function () {
                ctx.addPlaylistItem({ id: 2, title: 'dashboard: 2' });
                ctx.addTagPlaylistItem({ term: 'graphite' });
                ctx.filterFoundPlaylistItems();
            });
            it('playlistitems should be increased by one', function () {
                expect(ctx.playlistItems.length).toBe(2);
            });
            it('filtred playlistitems should be reduced by one', function () {
                expect(ctx.filteredDashboards.length).toBe(1);
                expect(ctx.filteredTags.length).toBe(1);
            });
            it('found dashboard should be 2', function () {
                expect(ctx.dashboardresult.length).toBe(2);
            });
            describe('removes one dashboard from playlist, ', function () {
                beforeEach(function () {
                    ctx.removePlaylistItem(ctx.playlistItems[0]);
                    ctx.removePlaylistItem(ctx.playlistItems[0]);
                    ctx.filterFoundPlaylistItems();
                });
                it('playlistitems should be increased by one', function () {
                    expect(ctx.playlistItems.length).toBe(0);
                });
                it('found dashboard should be 2', function () {
                    expect(ctx.dashboardresult.length).toBe(2);
                    expect(ctx.filteredDashboards.length).toBe(2);
                    expect(ctx.filteredTags.length).toBe(2);
                    expect(ctx.tagresult.length).toBe(2);
                });
            });
        });
    });
});
//# sourceMappingURL=playlist_edit_ctrl.test.js.map