#!/bin/bash
function exit_if_fail {
    command=$@
    echo "Executing '$command'"
    eval $command
    rc=$?
    if [ $rc -ne 0 ]; then
        echo "'$command' returned $rc."
        exit $rc
    fi
}

exit_if_fail npm run test:coverage
exit_if_fail npm run build

# publish code coverage
echo "Publishing javascript code coverage"
bash <(curl -s https://codecov.io/bash) -cF javascript
rm -rf coverage
