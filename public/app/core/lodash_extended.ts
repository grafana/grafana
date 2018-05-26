import _ from 'lodash';

/*
  Mixins :)
*/
_.mixin({
  move: function(array, fromIndex, toIndex) {
    array.splice(toIndex, 0, array.splice(fromIndex, 1)[0]);
    return array;
  },
});
