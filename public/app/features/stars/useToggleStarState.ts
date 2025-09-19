// import { useAddStarMutation, useRemoveStarMutation } from 'app/api/clients/preferences/v1alpha1';

export type Props = {
  group: string;
  kind: string;
  id: string; // name of the thing with a star
};

export function toggleStarState(isStarred: boolean, name: string, props: Props) {
  // Trying to call:
  //=================
  // addStar: build.mutation<AddStarApiResponse, AddStarApiArg>({
  //   query: (queryArg) => ({
  //     url: `/stars/${queryArg.name}/write/${queryArg.group}/${queryArg.kind}/${queryArg.id}`,
  //     method: 'PUT',
  //   }),
  //   invalidatesTags: ['Stars'],
  // }),
  // removeStar: build.mutation<RemoveStarApiResponse, RemoveStarApiArg>({
  //   query: (queryArg) => ({
  //     url: `/stars/${queryArg.name}/write/${queryArg.group}/${queryArg.kind}/${queryArg.id}`,
  //     method: 'DELETE',
  //   }),
  //   invalidatesTags: ['Stars'],
  // }),

  alert('TODO... toggle: ' + props.id);
  return;
}
