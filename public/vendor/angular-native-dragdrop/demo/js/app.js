angular.module('app', [
    'hljs',
    'ang-drag-drop'
]).controller('MainCtrl', function($scope) {
    $scope.men = [
        'John',
        'Jack',
        'Mark',
        'Ernie',
        'Mike (Locked)'
    ];


    $scope.women = [
        'Jane',
        'Jill',
        'Betty',
        'Mary'
    ];

    $scope.addText = '';

    $scope.dropValidateHandler = function($drop, $event, $data) {
        if ($data === 'Mike (Locked)') {
            return false;
        }
        if ($drop.element[0] === $event.srcElement.parentNode) {
            // Don't allow moving to same container
            return false;
        }
        return true;
    };

    $scope.dropSuccessHandler = function($event, index, array) {
        array.splice(index, 1);
    };

    $scope.onDrop = function($event, $data, array, index) {
        if (index !== undefined) {
            array.splice(index, 0, $data);
        } else {
            array.push($data);
        }
    };

});
