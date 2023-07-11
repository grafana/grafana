# 获取menu-generator

进入 grafana 项目根目录执行:
```shell
mkdir menu-generator && \
cd menu-generator && \
git init && \
git remote add -f origin https://github.com/bestchains/bc-console.git && \
git config core.sparsecheckout true && \
echo "config/menu/menu-generator" >> .git/info/sparse-checkout && \
git checkout main && \
cd ..
```
