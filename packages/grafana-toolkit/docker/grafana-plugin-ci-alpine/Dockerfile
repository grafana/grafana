FROM alpine 
USER root 
ADD scripts scripts
ADD install /usr/local/bin
WORKDIR scripts
RUN ./deploy.sh
