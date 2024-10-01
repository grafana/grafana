// import { css } from '@emotion/css';
// import { useState } from 'react';

// import { GrafanaTheme2 } from '@grafana/data';
// import { SceneComponentProps, sceneGraph, SceneObject, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
// import { useStyles2 } from '@grafana/ui';
// import { Text } from '@grafana/ui/src/components/Text/Text';

// import { DataTrailCard } from './DataTrailCard';
// import { DataTrailsApp } from './DataTrailsApp';
// import { getBookmarkKey, getTrailStore } from './TrailStore/TrailStore';
// import { reportExploreMetrics } from './interactions';

// export interface DataTrailsBookmarksState extends SceneObjectState { }

// export class DataTrailsBookmarks extends SceneObjectBase<DataTrailsBookmarksState> {
//     public constructor(state: DataTrailsBookmarksState) {
//         super(state);
//     }

//     // called when you click on a bookmark card
//     public onSelectBookmark = (bookmarkIndex: number) => {
//         const app = getAppFor(this);
//         reportExploreMetrics('exploration_started', { cause: 'bookmark_clicked' });
//         const trail = getTrailStore().getTrailForBookmarkIndex(bookmarkIndex);
//         getTrailStore().setRecentTrail(trail);
//         app.goToUrlForTrail(trail);
//     };

//     static Component = ({ model }: SceneComponentProps<DataTrailsHome>) => {
//         const [_, setLastDelete] = useState(Date.now());
//         const styles = useStyles2(getStyles);

//         const onDelete = (index: number) => {
//             getTrailStore().removeBookmark(index);
//             reportExploreMetrics('bookmark_changed', { action: 'deleted' });
//             setLastDelete(Date.now()); // trigger re-render
//         };

//         // current/old code: if there are no recent trails, show metrics select page (all metrics)
//         // probably need to change this logic to - if there are recent trails, show the sparklines, etc
//         // If there are no recent trails, don't show home page and create a new trail
//         // if (!getTrailStore().recent.length) {
//         //   const trail = newMetricsTrail(getDatasourceForNewTrail());
//         //   return <Redirect to={getUrlForTrail(trail)} />;
//         // }

//         return (
//             <div className={styles.container}>
//                 <div className={styles.column}>
//                     <Text variant="h4">Bookmarks</Text>
//                     <div className={styles.trailList}>
//                         {getTrailStore().bookmarks.map((bookmark, index) => {
//                             return (
//                                 <DataTrailCard
//                                     key={getBookmarkKey(bookmark)}
//                                     bookmark={bookmark}
//                                     onSelect={() => model.onSelectBookmark(index)}
//                                     onDelete={() => onDelete(index)}
//                                 />
//                             );
//                         })}
//                     </div>
//                 </div>
//             </div>
//         );
//     };
// }

// function getAppFor(model: SceneObject) {
//     return sceneGraph.getAncestor(model, DataTrailsApp);
// }

// function getStyles(theme: GrafanaTheme2) {
//     return {
//         container: css({
//             alignItems: 'center',
//             flexGrow: 1,
//             display: 'flex',
//             flexDirection: 'column',
//             gap: theme.spacing(3),
//         }),
//         column: css({
//             display: 'flex',
//             flexGrow: 1,
//             flexDirection: 'column',
//             gap: theme.spacing(2),
//         }),
//         trailList: css({
//             display: 'flex',
//             flexDirection: 'column',
//             gap: theme.spacing(2),
//         }),
//     };
// }
