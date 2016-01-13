import '../playlist_edit_ctrl';
import {describe, beforeEach, it, expect, angularMocks} from 'test/lib/common';
import helpers from 'test/specs/helpers';

describe('PlaylistEditCtrl', function() {
    var ctx = new helpers.ControllerTestContext();

    var searchResult = [
        {
            id: 2,
            title: 'dashboard: 2'
        },
        {
            id: 3,
            title: 'dashboard: 3'
        }
    ];

    var playlistSrv = {};
    var backendSrv = {
      search: (query) => {
        return ctx.$q.when(searchResult);
      }
    };

    beforeEach(angularMocks.module('grafana.core'));
    beforeEach(angularMocks.module('grafana.controllers'));
    beforeEach(angularMocks.module('grafana.services'));
    beforeEach(ctx.providePhase({
        playlistSrv: playlistSrv,
        backendSrv: backendSrv,
        $route: { current: { params: { } } },
    }));

    beforeEach(ctx.createControllerPhase('PlaylistEditCtrl'));

    beforeEach(() => {
        ctx.scope.$digest();
    });

    describe('searchresult returns 2 dashboards', function() {
        it('found dashboard should be 2', function() {
            expect(ctx.scope.foundPlaylistItems.length).to.be(2);
        });

        it('filtred dashboard should be 2', function() {
            expect(ctx.scope.filteredPlaylistItems.length).to.be(2);
        });

        describe('adds one dashboard to playlist', () => {
            beforeEach(() => {
                ctx.scope.addPlaylistItem({ id: 2, title: 'dashboard: 2' });
            });

            it('playlistitems should be increased by one', () => {
                expect(ctx.scope.playlistItems.length).to.be(1);
            });

            it('filtred playlistitems should be reduced by one', () => {
                expect(ctx.scope.filteredPlaylistItems.length).to.be(1);
            });

            it('found dashboard should be 2', function() {
                expect(ctx.scope.foundPlaylistItems.length).to.be(2);
            });

            describe('removes one dashboard from playlist', () => {
              beforeEach(() => {
                  ctx.scope.removePlaylistItem(ctx.scope.playlistItems[0]);
              });

              it('playlistitems should be increased by one', () => {
                  expect(ctx.scope.playlistItems.length).to.be(0);
              });

              it('found dashboard should be 2', function() {
                  expect(ctx.scope.foundPlaylistItems.length).to.be(2);
              });

              it('filtred playlist should be reduced by one', () => {
                  expect(ctx.scope.filteredPlaylistItems.length).to.be(2);
              });
            });
        });
    });
});
